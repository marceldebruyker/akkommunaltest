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

    if (!resendKey) return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY in Vercel.' }), { status: 500 });
    if (!supabaseUrl) return new Response(JSON.stringify({ error: 'Missing PUBLIC_SUPABASE_URL in Vercel.' }), { status: 500 });
    if (!supabaseKey) return new Response(JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY in Vercel.' }), { status: 500 });

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

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
      .in('video_slug', ['grundlagen', 'spezial', 'praktiker', 'gesamt', 'grundlagen-modul', 'spezialthemen-modul', 'praktiker-modul', 'gesamtpaket']);

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

    // Formatted Date
    const formattedDate = seminar.eventDate ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(seminar.eventDate)) : 'Datum noch festzulegen';

    const getEmailPayload = (user: any, emailType: string) => {
        let salutationString = '';
        if (user?.user_metadata?.salutation_string) {
            salutationString = ` ${user.user_metadata.salutation_string},`;
        } else if (user?.user_metadata?.first_name) {
            salutationString = ` ${user.user_metadata.first_name} ${user.user_metadata.last_name || ''},`.trim();
        } else {
            salutationString = ' Sehr geehrte Damen und Herren,'; // Fallback for very old users without names
        }

        let subject = '';
        let emailContent = '';

        if (emailType === 'ticket_invitation') {
            subject = `Einladung: Webinar „${seminar.title}“`;
            emailContent = `
              <h2 style="color: #05183a; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Einladung zum Webinar</h2>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag${salutationString}<br><br>herzlich möchten wir Sie zu unserem nächsten Webinar <strong>„${seminar.title}“</strong> einladen.</p>

              <!-- Dynamic Sanity Content (Thema / Inhalte) -->
              ${seminar.description ? `<div style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">${seminar.description.replace(/\n/g, '<br>')}</div>` : ''}

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                   <td style="padding: 20px;">
                     <p style="margin: 0; color: #0f172a; font-weight: 700; font-size: 16px;">🗓️ Termin: ${formattedDate} Uhr</p>
                    </td>
                  </tr>
              </table>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">Die Teilnahmegebühr für das Webinar beträgt <strong>${seminar.price ? seminar.price : '260'} Euro</strong> zuzüglich Umsatzsteuer.</p>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0; font-size: 15px;">Die Anmeldung für das Webinar können Sie gerne unter dem folgenden Link vornehmen:</p>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${new URL(request.url).origin}/termine/${seminar.slug}" style="display: inline-block; background-color: #05183a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(5, 24, 58, 0.2);">Zur Anmeldung</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 14px; background-color: #f1f5f9; padding: 15px; border-radius: 8px;">Für Mitglieder des Arbeitskreises Kommunal ist die Teilnahme in der Jahresgebühr bereits enthalten (Spezialthemen-Modul oder Modul Gesamtpaket). Eine Anmeldung über den Link ist nicht erforderlich.</p>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0; font-size: 15px;">Wir freuen uns auf Ihre Anmeldung und Ihre Teilnahme an unserem Webinar.<br><br>Freundliche Grüße aus Stuttgart<br><br>i. A. Freya Marx<br>Assistentin<br><br><strong>BW PARTNER</strong><br>Telefon +49 711 1640 1650<br>E-Mail <a href="mailto:seminare@bw-partner.com" style="color: #3b82f6;">seminare@bw-partner.com</a></p>
            `;
        } else {
            // DEFAULT: teams_link
            subject = `Ihre Einwahldaten: ${seminar.title}`;
            emailContent = `
              <h2 style="color: #05183a; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Ihre Einwahldaten für das Live-Seminar</h2>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag${salutationString} <br><br>hiermit erhalten Sie offiziell den Einladungs-Link für Ihr folgendes Live-Seminar. Bitte treten Sie dem MS-Teams-Raum rechtzeitig am folgenden Termin bei:</p>
                        
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                     <p style="margin: 0 0 10px 0; color: #0f172a; font-weight: 700; font-size: 16px;">${seminar.title}</p>
                     <p style="margin: 0; color: #05183a; font-weight: 600; font-size: 15px;">🗓️ ${formattedDate} Uhr</p>
                  </td>
                </tr>
              </table>
      
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${seminar.teamsLink}" style="display: inline-block; background-color: #05183a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(5, 24, 58, 0.2);">MS-Teams beitreten</a>
                  </td>
                </tr>
              </table>
                        
              <p style="color: #4b5563; line-height: 1.6; margin: 30px 0 0 0; font-size: 14px;"><strong>Alternativ-Link:</strong> Falls der Button nicht funktioniert, kopieren Sie bitte folgenden Link:<br><br><span style="word-break: break-all; color: #94a3b8;">${seminar.teamsLink}</span></p>
            `;
        }

        const htmlTemplate = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; background-color: #f3f4f6;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
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
              <!-- Content Area -->
              <tr>
                <td style="padding: 40px;">
                  ${emailContent}
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
        return { subject, html: htmlTemplate };
    };

    // Bulk Send in batches of 50 using Resend BATCH api for personalized emails
    const chunkSize = 50; 
    for (let i = 0; i < validUsers.length; i += chunkSize) {
      const batchUsers = validUsers.slice(i, i + chunkSize);
      
      const emailPayloads = batchUsers.filter(u => u.email).map(u => {
         const { subject, html } = getEmailPayload(u, emailType);
         return {
            from: `AK Kommunal Plattform <${senderEmail}>`,
            to: [u.email!],
            subject: subject,
            html: html
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

  } catch (error: any) {
    console.error("Broadcast Email Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
