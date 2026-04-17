import type { APIRoute } from "astro";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request, redirect, url }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();

  if (!email) {
    return redirect("/passwort-vergessen?error=" + encodeURIComponent("Bitte geben Sie eine gültige E-Mail-Adresse ein."));
  }

  const supabaseAdmin = getSupabaseAdmin();
  const baseUrl = new URL(request.url).origin;

  try {
    // 1. Generate the Recovery Link manually using Service Role
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${baseUrl}/passwort-aendern`
      }
    });

    if (linkError) {
      console.error("Supabase Generate Link Error:", linkError);
      return redirect("/passwort-vergessen?success=true"); // Fail silently for enumerations
    }

    // 2. Draft the beautiful custom Resend HTML Template
    const actionUrl = linkData.properties?.action_link;

    if (actionUrl) {
      const htmlEmail = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <tr>
              <td style="background-color: #05183a; padding: 40px 20px; text-align: center;">
                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                  <tr>
                    <td style="vertical-align: middle; text-align: left;">
                       <div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.1; margin: 0;">AK Kommunal</div>
                       <div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 8px; font-weight: 600; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 4px; line-height: 1;">Eine Marke von BW Partner</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin-top: 0; color: #05183a; font-size: 22px; font-weight: 800; margin-bottom: 20px;">Passwort zurücksetzen</h2>
                <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag,</p>
                <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Es wurde eine Anfrage gestellt, um das Passwort für Ihr AK Kommunal Fachportal zurückzusetzen. Klicken Sie auf den folgenden Button, um ein neues sicheres Passwort zu vergeben:</p>
                <div style="text-align: center;">
                  <a href="${actionUrl}" style="display: inline-block; background-color: #05183a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; margin: 30px 0;">Passwort jetzt ändern</a>
                </div>
                <div style="font-size: 13px; margin-top: 30px; line-height: 1.5; color: #64748b;">
                  Alternativ können Sie auch diesen Link markieren und manuell in Ihren Browser kopieren:<br>
                  <a href="${actionUrl}" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">${actionUrl}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5;">Sie haben diese Passwort-Änderung nicht in die Wege geleitet?<br>Dann können Sie diese E-Mail einfach ignorieren. Ihr aktuelles Passwort bleibt weiterhin gültig.</p>
                <p style="color: #94a3b8; font-size: 13px; margin: 10px 0 0 0; line-height: 1.5;">Bei technischen Problemen wenden Sie sich bitte an <a href="mailto:support@ak-kommunal.de" style="color: #3b82f6; text-decoration: underline;">support@ak-kommunal.de</a></p>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                  <strong>AK Kommunal – Eine Marke von BW Partner</strong><br>
                  BW PARTNER Bauer Schätz Hasenclever Partnerschaft mbB<br>
                  Hauptstraße 41, 70563 Stuttgart<br>
                  Amtsgericht Stuttgart PR 720097 | USt-IdNr.: DE257068936<br>
                  <a href="${baseUrl}/impressum" style="color: #94a3b8; text-decoration: underline;">Impressum</a> | <a href="${baseUrl}/datenschutz" style="color: #94a3b8; text-decoration: underline;">Datenschutz</a>
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      // 3. Send email!
      await resend.emails.send({
        from: 'AK Kommunal Fachportal <noreply@debruyker.de>',
        to: email,
        subject: '🔐 Neues Passwort für Ihr Fachportal veregeben',
        html: htmlEmail,
      });
    }

  } catch (err) {
    console.error("Recovery Email Dispatch Error:", err);
  }

  // Always return success to prevent email enumeration attacks
  return redirect("/passwort-vergessen?success=true");
};
