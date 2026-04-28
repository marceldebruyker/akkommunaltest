import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSupabaseServer, getSupabaseAdmin } from '../../lib/supabase';
import { sanityClient } from '../../lib/sanity';
import { Resend } from 'resend';
import { buildSalutation, purchaseConfirmationEmail } from '../../lib/emailTemplates';
import { logger } from '../../lib/logger';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = getSupabaseServer(request, cookies);
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const { items, isSubscription, user: userData } = body;

    let authUser = user;
    // True if we just created a brand-new account that hasn't confirmed its
    // email yet. In that case Supabase returns a user with no session — the
    // browser cookie isn't set, so any /app/* redirect will bounce to /login.
    // We surface this to the client so it can show a "check your inbox" hint
    // instead of silently dropping the user on the login page.
    let requiresEmailConfirmation = false;

    if (!authUser && userData) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            anrede: userData.anrede,
            first_name: userData.vorname,
            last_name: userData.nachname,
            salutation_string: ['Herr', 'Frau'].includes(userData.anrede) ? `${userData.anrede} ${userData.nachname}` : `${userData.vorname} ${userData.nachname}`,
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
        // No session means email confirmation is enabled in Supabase Auth and
        // the user hasn't clicked the link yet.
        requiresEmailConfirmation = !signUpData.session;
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
    const supabaseAdmin = getSupabaseAdmin();

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
      logger.error('Error granting access on invoice purchase', { error: insertError.message, userId: authUser.id });
      return new Response(JSON.stringify({ error: 'Rechnung generiert, aber Freischaltung verzögert. Bitte Support kontaktieren.' }), { status: 500 });
    }

    // 5. Send Confirmation Email via Resend
    const resendKey = import.meta.env.RESEND_API_KEY;
    if (resendKey && authUser.email) {
      const itemListHtml = items.map((i: { title: string }) => `<li><strong>${i.title}</strong></li>`).join('');
      const meta = {
        salutation_string: authUser.user_metadata?.salutation_string,
        first_name: authUser.user_metadata?.first_name ?? userData?.vorname,
        last_name: authUser.user_metadata?.last_name ?? userData?.nachname
      };

      let invoiceUrl: string | null = null;
      try {
        const finalizedInvoice = await stripe.invoices.retrieve(invoice.id);
        invoiceUrl = finalizedInvoice.hosted_invoice_url ?? null;
      } catch (err) {
        logger.warn('Could not retrieve hosted_invoice_url for email', { error: err instanceof Error ? err.message : String(err) });
      }

      const { subject, html } = purchaseConfirmationEmail({
        origin: new URL(request.url).origin,
        salutation: buildSalutation(meta),
        itemListHtml,
        invoiceUrl,
        paymentMethodLabel: 'Kauf auf Rechnung'
      });

      try {
        await new Resend(resendKey).emails.send({
          from: 'AK Kommunal Plattform <noreply@debruyker.de>',
          to: [authUser.email],
          subject,
          html
        });
      } catch (err) {
        logger.error('Resend Confirmation Error (Non-Fatal)', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, invoiceId: invoice.id, requiresEmailConfirmation }),
      { status: 200 }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    logger.error('Buy on Invoice Error', { error: msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
};
