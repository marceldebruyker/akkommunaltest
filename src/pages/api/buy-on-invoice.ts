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

    // 4. Zugriff sofort erteilen (Service Role DB Insert)
    const supabaseAdmin = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Profile exist check
    await supabaseAdmin.from('profiles').upsert({ id: authUser.id }, { onConflict: 'id' });

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
      const senderEmail = process.env.RESEND_API_KEY.includes('re_') && process.env.VERCEL_ENV !== 'production' 
        ? 'onboarding@resend.dev' 
        : 'noreply@bw-partner.de'; // Later set to noreply@bw-partner.de or verified domain

      const itemListHtml = items.map((i: any) => `<li><strong>${i.title}</strong></li>`).join('');

      try {
        await resend.emails.send({
           from: `AK Kommunal Plattform <${senderEmail}>`,
           to: [authUser.email!],
           subject: 'Erfolgreiche Anmeldung / Bestellung',
           html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #05183a; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">AK Kommunal Plattform</h1>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <h2 style="color: #05183a; margin-top: 0;">Vielen Dank für Ihre Buchung!</h2>
                <p style="color: #4b5563; line-height: 1.6;">Guten Tag ${userData.vorname || ''} ${userData.nachname || ''},<br><br>Ihre Buchung war erfolgreich. Die Rechnung haben wir Ihnen aus unserem Stripe-System separat zukommen lassen.</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0 0 10px 0; color: #374151;"><strong>Ihre gebuchten Inhalte:</strong></p>
                  <ul style="margin: 0; color: #374151; padding-left: 20px;">
                    ${itemListHtml}
                  </ul>
                </div>
                <p style="color: #4b5563; line-height: 1.6;">Die Inhalte sind ab sofort in Ihrem persönlichen Dashboard freigeschaltet.</p>
                <a href="${new URL(request.url).origin}/app/dashboard" style="display: inline-block; background-color: #05183a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Zum Fachportal</a>
              </div>
            </div>
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
