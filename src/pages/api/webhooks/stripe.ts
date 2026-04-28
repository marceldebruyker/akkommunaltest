import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { Resend } from 'resend';
import { buildSalutation, purchaseConfirmationEmail } from '../../../lib/emailTemplates';
import { logger } from '../../../lib/logger';

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

    // Idempotency: Stripe retries on 5xx and on transient network failures, so the same
    // event.id can arrive multiple times. We insert into stripe_events first; the unique
    // constraint on event_id makes a duplicate fail and we short-circuit with 200.
    const supabaseAdmin = getSupabaseAdmin();
    const { error: idempotencyError } = await supabaseAdmin
      .from('stripe_events')
      .insert({ event_id: event.id, type: event.type });

    if (idempotencyError) {
      // 23505 = unique violation = already processed. Anything else is a real error.
      if (idempotencyError.code === '23505') {
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
      }
      throw idempotencyError;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.client_reference_id;
      const videoSlugsArray = session.metadata?.video_slugs?.split(',') || [];

      if (userId && videoSlugsArray.length > 0) {

        // Ensure a profile exists for this user to satisfy foreign key constraints.
        // We do a simple upsert. If it exists, nothing changes. If missing, it creates a blank profile.
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({ id: userId }, { onConflict: 'id' });
          
        if (profileError) {
          logger.warn('Profile upsert warning', { error: profileError.message, userId });
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
          logger.error('Error inserting purchases to DB', { error: insertError.message, userId, eventId: event.id });
          return new Response('Database Write Failed', { status: 500 });
        }

        // --- Send Resend Email Confirmation ---
        const resendKey = import.meta.env.RESEND_API_KEY;
        if (resendKey && session.customer_details?.email) {
          try {
            const lineItemsList = await stripe.checkout.sessions.listLineItems(session.id);
            const itemListHtml = lineItemsList.data
              .map(i => `<li><strong>${i.description}</strong></li>`)
              .join('');

            const fallbackName = session.customer_details?.name ?? '';
            let meta: { salutation_string?: string; first_name?: string; last_name?: string } = {
              salutation_string: fallbackName || undefined
            };
            if (userId) {
              const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
              if (user?.user_metadata) meta = user.user_metadata as typeof meta;
            }

            // Re-fetch the invoice so we always have the live hosted_invoice_url.
            let invoiceUrl: string | null = null;
            if (session.invoice) {
              try {
                const finalizedInvoice = await stripe.invoices.retrieve(session.invoice as string);
                invoiceUrl = finalizedInvoice.hosted_invoice_url ?? null;
              } catch (err) {
                logger.warn('Could not retrieve hosted_invoice_url for email', { error: err instanceof Error ? err.message : String(err) });
              }
            }

            const { subject, html } = purchaseConfirmationEmail({
              origin: new URL(request.url).origin,
              salutation: buildSalutation(meta),
              itemListHtml,
              invoiceUrl,
              paymentMethodLabel: session.payment_status === 'paid'
                ? 'Kreditkarte/Direktzahlung über Stripe'
                : 'Überweisung über Stripe'
            });

            await new Resend(resendKey).emails.send({
              from: 'AK Kommunal Plattform <noreply@debruyker.de>',
              to: [session.customer_details.email],
              subject,
              html
            });
          } catch (resendError) {
            logger.error('Webhook Resend Flow Error', { error: resendError instanceof Error ? resendError.message : String(resendError) });
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Stripe Webhook Error', { error: msg });
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }
};
