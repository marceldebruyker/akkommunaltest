import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { sanityClient } from '../../../lib/sanity';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { seminarId, password, emailType } = await request.json();

    // 1. Einfache, aber effektive Passwortsperre (wird im Sanity UI vom Mitarbeiter eingegeben)
    if (password !== 'kommunal-einladung-2026!') {
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
    
    const resendKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!resendKey || !supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables.' }), { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // 4. Zielgruppe (Kohorte) identifizieren: Abo-Kunden UND Einzelkäufer dieses Videos
    // - Abo Kunden:
    const { data: abonnementProfiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('has_membership', true);
      
    // - Einzelkäufer (Video-Slug basiert)
    const { data: expressPurchases } = await supabaseAdmin
      .from('purchases')
      .select('user_id')
      .eq('video_slug', seminar.slug);

    const aboIds = (abonnementProfiles || []).map(p => p.id);
    const purchaseIds = (expressPurchases || []).map(p => p.user_id);
    
    // Kombinieren & doppelte IDs filtern
    const uniqueUserIds = Array.from(new Set([...aboIds, ...purchaseIds]));

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
    const senderEmail = resendKey.includes('re_') && import.meta.env.VERCEL_ENV !== 'production' 
        ? 'onboarding@resend.dev' 
        : 'noreply@bw-partner.de'; 

    // Formatted Date
    const formattedDate = seminar.eventDate ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(seminar.eventDate)) : 'Datum noch festzulegen';

    // Bestimme den E-Mail Inhalt anhand des Typs
    let subject = '';
    let emailContent = '';

    if (emailType === 'ticket_invitation') {
      subject = `Offizielle Einladung: ${seminar.title}`;
      emailContent = `
        <h2 style="color: #05183a; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Ihre Einladung: ${seminar.title}</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag, <br><br>hiermit laden wir Sie herzlich zu unserer kommenden Weiterbildung ein. Bitte notieren Sie sich den folgenden Termin in Ihrem Kalender:</p>
                  
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
          <tr>
             <td style="padding: 20px;">
               <p style="margin: 0 0 10px 0; color: #0f172a; font-weight: 700; font-size: 16px;">${seminar.title}</p>
               <p style="margin: 0 0 10px 0; color: #f8981d; font-weight: 600; font-size: 15px;">🗓️ ${formattedDate} Uhr</p>
               ${seminar.duration ? `<p style="margin: 0; color: #64748b; font-size: 14px;">⏱️ Dauer: ca. ${seminar.duration}</p>` : ''}
              </td>
            </tr>
        </table>

        ${seminar.description ? `<p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 15px;"><strong>Darum geht es:</strong><br>${seminar.description}</p>` : ''}
                  
        <p style="color: #4b5563; line-height: 1.6; margin: 30px 0 0 0; font-size: 14px;"><strong>Hinweis zur Einwahl:</strong> Die genauen MS-Teams Einwahldaten senden wir Ihnen kurz vor der Veranstaltung separat und aktuell an diese E-Mail-Adresse zu.</p>
      `;
    } else {
      // DEFAULT: teams_link
      subject = `Ihre Einwahldaten: ${seminar.title}`;
      emailContent = `
        <h2 style="color: #05183a; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Ihre Einwahldaten für das Live-Seminar</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag, <br><br>hiermit erhalten Sie offiziell den Einladungs-Link für Ihr folgendes Live-Seminar. Bitte treten Sie dem MS-Teams-Raum rechtzeitig am folgenden Termin bei:</p>
                  
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
          <tr>
            <td style="padding: 20px;">
               <p style="margin: 0 0 10px 0; color: #0f172a; font-weight: 700; font-size: 16px;">${seminar.title}</p>
               <p style="margin: 0; color: #f8981d; font-weight: 600; font-size: 15px;">🗓️ ${formattedDate} Uhr</p>
            </td>
          </tr>
        </table>

        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <a href="${seminar.teamsLink}" style="display: inline-block; background-color: #f8981d; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(248, 152, 29, 0.2);">Jetzt MS-Teams Raum beitreten</a>
            </td>
          </tr>
        </table>
                  
        <p style="color: #4b5563; line-height: 1.6; margin: 30px 0 0 0; font-size: 14px;"><strong>Alternativ-Link:</strong> Falls der Button nicht funktioniert, kopieren Sie bitte folgenden Link:<br><br><span style="word-break: break-all; color: #94a3b8;">${seminar.teamsLink}</span></p>
      `;
    }

    const sendBatch = async (batch: string[]) => {
      await resend.emails.send({
        from: `AK Kommunal Plattform <${senderEmail}>`,
        to: ['noreply@bw-partner.de'], // Sichtbarer "To" Header
        bcc: batch,                   // Versteckte Serienbrief-Empfänger
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; background-color: #f3f4f6;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <tr>
                <td style="background-color: #05183a; padding: 30px 40px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">AK Kommunal Plattform</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  ${emailContent}
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      });
    };

    // Bulk Send in 50-Mail Batches to heavily respect Resend API rate limits
    // https://resend.com/docs/api-reference/emails/send-email (limit max 50 for bcc usually)
    const chunkSize = 50;
    for (let i = 0; i < toEmails.length; i += chunkSize) {
      const batch = toEmails.slice(i, i + chunkSize);
      await sendBatch(batch);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Einladungen erfolgreich an ${toEmails.length} Teilnehmer versendet.` 
    }), { status: 200 });

  } catch (error: any) {
    console.error("Broadcast Email Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
