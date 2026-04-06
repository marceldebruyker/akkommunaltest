import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
};
