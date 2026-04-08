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
            
            const senderEmail = process.env.RESEND_API_KEY.includes('re_') && process.env.VERCEL_ENV !== 'production' 
              ? 'onboarding@resend.dev' 
              : 'noreply@bw-partner.de'; 

            const customerNamePart = session.customer_details?.name ? ` ${session.customer_details.name},` : ',';

            await resend.emails.send({
              from: `AK Kommunal Plattform <${senderEmail}>`,
              to: [session.customer_details.email],
              subject: 'Erfolgreiche Anmeldung / Bestellung',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                  <div style="background-color: #05183a; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">AK Kommunal Plattform</h1>
                  </div>
                  <div style="padding: 30px; background-color: #ffffff;">
                    <h2 style="color: #05183a; margin-top: 0;">Vielen Dank für Ihre Buchung!</h2>
                    <p style="color: #4b5563; line-height: 1.6;">Guten Tag${customerNamePart}<br><br>Ihre Buchung über Stripe (${session.payment_status === 'paid' ? 'Kreditkarte/Direktzahlung' : 'Überweisung'}) war erfolgreich! Ihre Rechnung wird von Stripe separat versandt.</p>
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
