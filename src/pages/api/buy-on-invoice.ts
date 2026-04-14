import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSupabaseServer } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { sanityClient } from '../../lib/sanity';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = getSupabaseServer(request, cookies);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const body = await request.json();
    const { items, isSubscription, user: userData } = body;

    let authUser = user;

    if (!authUser && userData) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.vorname,
            last_name: userData.nachname,
            leitwegId: userData.leitwegId,
            behorde: userData.behorde,
            strasse: userData.strasse,
            plz: userData.plz,
            ort: userData.ort
          }
        }
      });

      if (signUpError && signUpError.message.includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: userData.password
        });
        if (signInError) return new Response(JSON.stringify({ error: 'E-Mail existiert bereits. Bitte loggen Sie sich ein oder prüfen Sie Ihr Passwort.' }), { status: 401 });
        authUser = signInData.user;
      } else if (signUpError) {
        return new Response(JSON.stringify({ error: signUpError.message }), { status: 400 });
      } else {
        authUser = signUpData.user;
      }
    }

    if (!authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Bitte registrieren oder einloggen.' }), { status: 401 });
    }

    const rawStripeKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!rawStripeKey) return new Response(JSON.stringify({ error: 'Stripe configuration missing' }), { status: 500 });
    const stripe = new Stripe(rawStripeKey.trim());

    // Abgleich der Preise mit Sanity für Sicherheit
    const sanityProducts = await sanityClient.fetch(`*[_type == "seminar"]{ "id": slug.current, title, price }`);

    // Prevent Duplicate Purchases (Verhindern von Mehrfachkäufen)
    if (!isSubscription) {
      const requestedSlugs = items.map((i: any) => i.id);
      const { data: existingPurchases } = await supabase
        .from('purchases')
        .select('video_slug')
        .eq('user_id', authUser.id)
        .in('video_slug', requestedSlugs);

      if (existingPurchases && existingPurchases.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'Sie besitzen bereits Artikel, die sich in Ihrem Warenkorb befinden. Bitte entfernen Sie diese vor dem Bezahlen.' 
        }), { status: 400 });
      }
    }

    // 1. Stripe Customer erstellen
    const customer = await stripe.customers.create({
      email: authUser.email,
      name: `${userData.vorname || ''} ${userData.nachname || ''}`.trim(),
      description: userData.behorde || 'Kauf auf Rechnung',
      address: {
        line1: userData.strasse || undefined,
        postal_code: userData.plz || undefined,
        city: userData.ort || undefined,
        country: 'DE'
      },
      metadata: {
        leitweg_id: userData.leitwegId || '',
        user_id: authUser.id
      }
    });

    // 2. Invoice Items erstellen
    for (const item of items) {
      let slug = item.id;
      let title = item.title;
      let price = item.price;

      if (!isSubscription) {
        const canonicalProduct = sanityProducts.find((p: any) => p.id === item.id);
        if (!canonicalProduct) throw new Error(`Product ${item.id} not found.`);
        title = canonicalProduct.title;
        price = canonicalProduct.price || 0;
      }

      await stripe.invoiceItems.create({
        customer: customer.id,
        currency: 'eur',
        amount: Math.round(price * 100),
        description: `${isSubscription ? 'Abonnement Gebühr (jährlich) -' : 'Fachvideo / Seminar -'} ${title}`,
      });
    }

    // 3. Draft Invoice generieren & verschicken
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 14,
      auto_advance: true, // Stripe tries to finalize and send it out based on configured intervals
      pending_invoice_items_behavior: 'include',
      custom_fields: userData.leitwegId ? [
        { name: 'Leitweg-ID', value: userData.leitwegId }
      ] : undefined
    });

    // Sofort Finalisieren und E-Mail Senden erzwingen
    await stripe.invoices.sendInvoice(invoice.id);

    // 4. Zugriff & Profil-Updates (Service Role)
    const supabaseAdmin = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Profil in DB sicherstellen
    await supabaseAdmin.from('profiles').upsert({ id: authUser.id }, { onConflict: 'id' });

    // Billing Daten für automatisiertes Ausfüllen beim nächsten Kauf cachen
    await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        behorde: userData.behorde,
        strasse: userData.strasse,
        plz: userData.plz,
        ort: userData.ort,
        leitwegId: userData.leitwegId
      }
    });

    const purchasesToInsert = items.map((item: any) => ({
      user_id: authUser?.id,
      video_slug: item.id,
      stripe_session_id: `invoice_${invoice.id}`
    }));

    const { error: insertError } = await supabaseAdmin.from('purchases').insert(purchasesToInsert);

    if (insertError) {
      console.error('Error granting access on invoice purchase:', insertError.message);
      return new Response(JSON.stringify({ error: 'Rechnung generiert, aber Freischaltung verzögert. Bitte Support kontaktieren.' }), { status: 500 });
    }

    // 5. Send Confirmation Email via Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const senderEmail = 'noreply@debruyker.de';

      const itemListHtml = items.map((i: any) => `<li><strong>${i.title}</strong></li>`).join('');

      let salutationString = `${userData?.vorname || ''} ${userData?.nachname || ''}`.trim();
      if (authUser?.user_metadata?.salutation_string) {
         salutationString = authUser.user_metadata.salutation_string;
      } else if (authUser?.user_metadata?.first_name) {
         salutationString = `${authUser.user_metadata.first_name} ${authUser.user_metadata.last_name || ''}`.trim();
      }
      const customerNamePart = salutationString ? ` ${salutationString},` : ',';

      // Re-fetch the invoice to ensure we have the live hosted_invoice_url
      let invoiceUrlHtml = '';
      try {
        const finalizedInvoice = await stripe.invoices.retrieve(invoice.id);
        if (finalizedInvoice.hosted_invoice_url) {
          invoiceUrlHtml = `<div style="margin-top: 25px; padding: 15px; border-left: 3px solid #05183a; background-color: #f1f5f9;"><p style="margin: 0; font-size: 15px; color: #4b5563;">Rechnungsdokument (PDF): <br><a href="${finalizedInvoice.hosted_invoice_url}" style="color: #05183a; font-weight: 600; text-decoration: underline;">📄 Hier können Sie Ihre offizielle Stripe-Rechnung herunterladen</a></p></div>`;
        }
      } catch (err) {
        console.warn('Could not retrieve hosted_invoice_url for email.', err);
      }

      try {
        await resend.emails.send({
           from: `AK Kommunal Plattform <${senderEmail}>`,
           to: [authUser.email!],
           subject: 'Erfolgreiche Anmeldung / Bestellung',
           html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <!-- Top-Notch Premium Header: Logo + Typographie -->
                    <tr>
                      <td style="background-color: #05183a; padding: 40px 20px; text-align: center;">
                        <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                          <tr>
                            <!-- Lion Logo (Square) -->
                            <td width="36" style="padding-right: 12px; vertical-align: middle;">
                              <img src="${new URL(request.url).origin}/email-lion-inverted.svg?v=2" alt="AK Kommunal Logo" width="36" height="36" style="display: block; width: 36px; height: 36px; border: none;" />
                            </td>
                            <!-- Brand Typography -->
                            <td style="vertical-align: middle; text-align: left;">
                               <div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.1; margin: 0;">AK Kommunal</div>
                               <div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 8px; font-weight: 600; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 4px; line-height: 1;">Eine Marke von BW Partner</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="color: #05183a; margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 700;">Vielen Dank für Ihre Buchung!</h2>
                        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag${customerNamePart}<br><br>herzlichen Glückwunsch, Ihre Buchung (Kauf auf Rechnung) war erfolgreich. Die Rechnung für Ihre Unterlagen haben wir Ihnen aus unserem Stripe-System soeben separat an Sie versendet.</p>
                        
                        <!-- Order Summary Box -->
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="margin: 0 0 12px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Ihre gebuchten Inhalte:</p>
                              <ul style="margin: 0; color: #475569; padding-left: 20px; line-height: 1.6; font-size: 15px;">
                                ${itemListHtml}
                              </ul>
                              ${invoiceUrlHtml}
                            </td>
                          </tr>
                        </table>

                        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">Ihre Weiterbildungsinhalte wurden Ihrem Konto zugewiesen und sind <strong>ab sofort</strong> in Ihrem persönlichen Dashboard für Sie abrufbar.</p>
                        
                        <!-- CTA Button -->
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center">
                              <a href="${new URL(request.url).origin}/app/dashboard" style="display: inline-block; background-color: #05183a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(5, 24, 58, 0.2);">Jetzt zum Fachportal</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
                        <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5;">Sie haben Fragen zu Ihrer Buchung oder Rechnung?<br>Antworten Sie einfach auf diese E-Mail oder kontaktieren Sie unseren Support.</p>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
           `
        });
      } catch (err) {
        console.error("Resend Confirmation Error (Non-Fatal):", err);
      }
    }

    return new Response(JSON.stringify({ success: true, invoiceId: invoice.id }), { status: 200 });

  } catch (error: any) {
    console.error("Buy on Invoice Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
