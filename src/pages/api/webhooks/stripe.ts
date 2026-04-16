import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  const stripeKeyRaw = import.meta.env.STRIPE_SECRET_KEY;
  const stripe = new Stripe(stripeKeyRaw ? stripeKeyRaw.trim() : '');
  const signature = request.headers.get('stripe-signature');
  const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !endpointSecret) {
    return new Response('Webhook Secret missing', { status: 400 });
  }

  try {
    const bodyText = await request.text();
    const event = stripe.webhooks.constructEvent(bodyText, signature, endpointSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.client_reference_id;
      const videoSlugsArray = session.metadata?.video_slugs?.split(',') || [];

      if (userId && videoSlugsArray.length > 0) {
        // Initialize Supabase Admin Client (Service Role) to bypass RLS and insert purchases securely
        const supabaseAdmin = createClient(
          import.meta.env.PUBLIC_SUPABASE_URL,
          import.meta.env.SUPABASE_SERVICE_ROLE_KEY, // CRITICAL: This bypasses RLS
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Ensure a profile exists for this user to satisfy foreign key constraints.
        // We do a simple upsert. If it exists, nothing changes. If missing, it creates a blank profile.
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({ id: userId }, { onConflict: 'id' });
          
        if (profileError) {
          console.error("Profile upsert warning:", profileError.message);
        }

        const purchasesToInsert = videoSlugsArray.map(slug => ({
          user_id: userId,
          video_slug: slug,
          stripe_session_id: session.id
        }));

        const { error: insertError } = await supabaseAdmin
          .from('purchases')
          .insert(purchasesToInsert);

        if (insertError) {
          console.error('Error inserting purchases to DB:', insertError.message);
          return new Response('Database Write Failed', { status: 500 });
        }

        // --- Send Resend Email Confirmation ---
        if (process.env.RESEND_API_KEY && session.customer_details?.email) {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const lineItemsList = await stripe.checkout.sessions.listLineItems(session.id);
            const itemListHtml = lineItemsList.data
              .map(i => `<li><strong>${i.description}</strong></li>`)
              .join('');
            
            const senderEmail = 'noreply@debruyker.de';

            let salutationString = session.customer_details?.name ? `${session.customer_details.name}` : '';
            if (userId) {
              const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
              if (user?.user_metadata?.salutation_string) {
                salutationString = user.user_metadata.salutation_string;
              }
            }

            const customerNamePart = salutationString ? ` ${salutationString},` : ',';
            
            // Re-fetch the invoice to ensure we have the live hosted_invoice_url
            let invoiceUrlHtml = '';
            if (session.invoice) {
              try {
                const finalizedInvoice = await stripe.invoices.retrieve(session.invoice as string);
                if (finalizedInvoice.hosted_invoice_url) {
                  invoiceUrlHtml = `<div style="margin-top: 25px; padding: 15px; border-left: 3px solid #05183a; background-color: #f1f5f9;"><p style="margin: 0; font-size: 15px; color: #4b5563;">Rechnungsdokument (PDF): <br><a href="${finalizedInvoice.hosted_invoice_url}" style="color: #05183a; font-weight: 600; text-decoration: underline;">📄 Hier können Sie Ihre offizielle Stripe-Rechnung herunterladen</a></p></div>`;
                }
              } catch (err) {
                console.warn('Could not retrieve hosted_invoice_url for email.', err);
              }
            }

            await resend.emails.send({
              from: `AK Kommunal Plattform <${senderEmail}>`,
              to: [session.customer_details.email],
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
                              <img src="${process.env.PUBLIC_URL || 'https://www.ak-kommunal.de'}/email-lion-inverted.svg?v=2" alt="AK Kommunal Logo" width="36" height="36" style="display: block; width: 36px; height: 36px; border: none;" />
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
                        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag${customerNamePart}<br><br>herzlichen Glückwunsch! Ihre Buchung über Stripe (${session.payment_status === 'paid' ? 'Kreditkarte/Direktzahlung' : 'Überweisung'}) war erfolgreich. Ihre Rechnung wurde von unserem System soeben separat für Sie generiert.</p>
                        
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
                        <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5;">Sie haben Fragen zu Ihrer Buchung?<br>Antworten Sie einfach auf diese E-Mail oder kontaktieren Sie unseren Support.</p>
                        
                        <!-- Legal Impressum -->
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                          <strong>AK Kommunal – Eine Marke der BW Partner Gruppe</strong><br>
                          BW PARTNER Bauer Schätz Hasenclever Partnerschaft mbB<br>
                          Hauptstraße 41, 70563 Stuttgart<br>
                          Amtsgericht Stuttgart PR 720097 | USt-IdNr.: DE257068936<br>
                          <a href="https://www.ak-kommunal.de/impressum" style="color: #94a3b8; text-decoration: underline;">Impressum</a> | <a href="https://www.ak-kommunal.de/datenschutz" style="color: #94a3b8; text-decoration: underline;">Datenschutz</a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
              `
            });
          } catch (resendError: any) {
            console.error('Webhook Resend Flow Error:', resendError.message);
          }
        }
        // ----------------------------------------
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
};
