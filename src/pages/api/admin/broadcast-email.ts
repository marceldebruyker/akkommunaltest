import type { APIRoute } from 'astro';
import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { requireAdmin } from '../../../lib/apiAuth';
import { sanityClient } from '../../../lib/sanity';
import { Resend } from 'resend';
import { buildSalutation, ticketInvitationEmail, teamsLinkEmail } from '../../../lib/emailTemplates';
import { logger } from '../../../lib/logger';

type EmailType = 'ticket_invitation' | 'teams_link';

const MEMBERSHIP_MODULE_SLUGS = [
  'grundlagen', 'spezial', 'praktiker', 'gesamt',
  'grundlagen-modul', 'spezialthemen-modul', 'praktiker-modul', 'gesamtpaket'
];

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Defense in depth: must be a logged-in admin AND know the broadcast password.
    // The password is an extra confirmation step inside the Sanity admin UI to
    // prevent accidental sends; the cookie check prevents anonymous abuse if the
    // password ever leaks.
    const auth = await requireAdmin({ request, cookies });
    if (!auth.ok) return auth.response;

    const { seminarId, password, emailType } = await request.json();

    const broadcastPassword = import.meta.env.BROADCAST_ADMIN_PASSWORD;
    if (!broadcastPassword) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: BROADCAST_ADMIN_PASSWORD missing' }), { status: 500 });
    }
    if (password !== broadcastPassword) {
      return new Response(JSON.stringify({ error: 'Falsches Administratoren-Passwort' }), { status: 401 });
    }

    if (!seminarId) return new Response(JSON.stringify({ error: 'Muss seminarId enthalten.' }), { status: 400 });

    // 2. Seminar-Daten aus Sanity laden (Titel, Datum, Teams-Link)
    const seminar = await sanityClient.fetch(`*[_type == "seminar" && _id == $id][0] {
      "slug": slug.current,
      title,
      description,
      duration,
      eventDate,
      teamsLink
    }`, { id: seminarId });

    if (!seminar) return new Response(JSON.stringify({ error: 'Seminar in Sanity nicht gefunden.' }), { status: 404 });
    
    // Validate fields based on type
    if (emailType === 'teams_link' && !seminar.teamsLink) {
      return new Response(JSON.stringify({ error: 'Dieses Seminar hat noch keinen MS-Teams Link hinterlegt!' }), { status: 400 });
    }
    
    // ... [Database Auth Validation from Line 28 to 78 remains completely identical] ...
    
    const resendKey = import.meta.env.RESEND_API_KEY;
    if (!resendKey) return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500 });

    const supabaseAdmin = getSupabaseAdmin();

    // 4. Zielgruppe (Kohorte) identifizieren: Abo-Kunden UND Einzelkäufer dieses Videos
    // - Abo Kunden (Alte Methode über Profil-Flag):
    const { data: abonnementProfiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('has_membership', true);
      
    // - Abo Kunden (Neue Methode über Käufe der Module):
    const { data: abonnementPurchases } = await supabaseAdmin
      .from('purchases')
      .select('user_id')
      .in('video_slug', MEMBERSHIP_MODULE_SLUGS);

    // - Einzelkäufer (Video-Slug basiert)
    const { data: expressPurchases } = await supabaseAdmin
      .from('purchases')
      .select('user_id')
      .eq('video_slug', seminar.slug);

    const aboIds = (abonnementProfiles || []).map(p => p.id);
    const modulePurchaserIds = (abonnementPurchases || []).map(p => p.user_id);
    const purchaseIds = (expressPurchases || []).map(p => p.user_id);
    
    // Kombinieren & doppelte IDs filtern
    const uniqueUserIds = Array.from(new Set([...aboIds, ...modulePurchaserIds, ...purchaseIds]));

    if (uniqueUserIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Dieses Seminar hat noch gar keine berechtigten Käufer.' }), { status: 400 });
    }

    // E-Mail-Adressen für diese IDs laden (über Auth Admin Hook)
    const { data: { users: allAuthUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 10000 });
    
    // Filter out users based on the uniqueUserIds list
    const validUsers = allAuthUsers.filter(u => uniqueUserIds.includes(u.id));
    const toEmails = validUsers.map(u => u.email).filter(Boolean) as string[];

    if (toEmails.length === 0) {
      return new Response(JSON.stringify({ error: 'Konnte keine E-Mail Adressen zu den Berechtigten finden.' }), { status: 400 });
    }

    // 5. E-Mail Massenversand (Broadcast) formatieren
    const resend = new Resend(resendKey);
    const senderEmail = 'noreply@debruyker.de';
    const origin = new URL(request.url).origin;
    const formattedDate = seminar.eventDate
      ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(seminar.eventDate))
      : 'Datum noch festzulegen';
    const aboMemberIdSet = new Set([...aboIds, ...modulePurchaserIds]);

    const renderForUser = (u: User) => {
      const meta = (u.user_metadata ?? {}) as { salutation_string?: string; first_name?: string; last_name?: string };
      const salutation = buildSalutation(meta);
      const isMember = aboMemberIdSet.has(u.id);
      const opts = { origin, salutation, seminar, formattedDate, isMember };
      return (emailType as EmailType) === 'ticket_invitation'
        ? ticketInvitationEmail(opts)
        : teamsLinkEmail(opts);
    };

    // Resend BATCH api supports up to 100 personalized emails per call.
    const chunkSize = 50;
    for (let i = 0; i < validUsers.length; i += chunkSize) {
      const emailPayloads = validUsers
        .slice(i, i + chunkSize)
        .filter(u => u.email)
        .map(u => {
          const { subject, html } = renderForUser(u);
          return {
            from: `AK Kommunal Plattform <${senderEmail}>`,
            to: [u.email!],
            subject,
            html
          };
        });

      if (emailPayloads.length > 0) {
        await resend.batch.send(emailPayloads);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Einladungen erfolgreich an ${toEmails.length} Teilnehmer versendet.` 
    }), { status: 200 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    logger.error('Broadcast Email Error', { error: msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
};
