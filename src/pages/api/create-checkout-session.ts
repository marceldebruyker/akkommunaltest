import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSupabaseServer } from '../../lib/supabase';
import { sanityClient } from '../../lib/sanity';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Authentifizieren des Nutzers
    const supabase = getSupabaseServer(request, cookies);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // 3. Payload parsen
    const body = await request.json();
    const { items, isSubscription, user: userData } = body;

    let authUser = user;

    if (!authUser && userData) {
      // Vorsicht: Neu-Registrierung
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.vorname,
            last_name: userData.nachname,
            leitwegId: userData.leitwegId,
            behorde: userData.behorde
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

    // 2. Stripe Initialisierung
    const rawStripeKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!rawStripeKey) return new Response(JSON.stringify({ error: 'Stripe configuration missing' }), { status: 500 });
    const stripe = new Stripe(rawStripeKey.trim());
    const origin = new URL(request.url).origin;

    // Fetch safe products from Sanity
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

    // 4. Checkout Session generieren
    const sessionConfig: any = {
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card', 'paypal', 'sepa_debit'],
      customer_email: authUser.email,
      client_reference_id: authUser.id,
      billing_address_collection: 'required', // Erzwingt eine Rechnungsadresse
      tax_id_collection: {
        enabled: true, // Erlaubt Firmenkunden die Eingabe ihrer Umsatzsteuer-ID
      },
      line_items: items.map((item: any) => {
        let slug = item.id;
        let title = item.title;
        let price = item.price;

        if (!isSubscription) {
          const canonicalProduct = sanityProducts.find((p: any) => p.id === item.id);
          if (!canonicalProduct) throw new Error(`Product ${item.id} not found.`);
          slug = canonicalProduct.id;
          title = canonicalProduct.title;
          price = canonicalProduct.price || 0;
        }

        return {
          price_data: {
            currency: 'eur',
            product_data: {
              name: title,
              metadata: { video_slug: slug }
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        };
      }),
      metadata: {
        user_id: authUser.id,
        video_slugs: items.map((i: any) => i.id).join(','),
      },
      success_url: `${origin}/app/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/kasse`,
    };

    // Invoice Creation darf nur im 'payment' Modus übergeben werden
    if (!isSubscription) {
      sessionConfig.invoice_creation = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(JSON.stringify({ url: session.url, success: true }), { status: 200 });

  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
