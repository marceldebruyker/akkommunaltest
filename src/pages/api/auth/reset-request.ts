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
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased; }
            .container { background-color: #ffffff; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { background-color: #05183a; padding: 40px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
            .content { padding: 40px; color: #4b5563; line-height: 1.6; }
            .content h2 { margin-top: 0; color: #05183a; font-size: 22px; font-weight: 800; mb-4; }
            .button { display: inline-block; background-color: #05183a; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; margin: 30px 0; border: none; }
            .footer { background-color: #f8fafc; padding: 30px 40px; font-size: 13px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; }
            .copy-link { font-size: 13px; margin-top: 30px; line-height: 1.5; color: #64748b; }
            .copy-link a { color: #3b82f6; text-decoration: underline; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AK Kommunal Plattform</h1>
            </div>
            <div class="content">
              <h2>Passwort zurücksetzen</h2>
              <p>Guten Tag,</p>
              <p>Es wurde eine Anfrage gestellt, um das Passwort für Ihr AK Kommunal Fachportal zurückzusetzen. Klicken Sie auf den folgenden Button, um ein neues sicheres Passwort zu vergeben:</p>
              <div style="text-align: center;">
                <a href="${actionUrl}" class="button">Passwort jetzt ändern</a>
              </div>
              
              <div class="copy-link">
                Alternativ können Sie auch diesen Link markieren und manuell in Ihren Browser kopieren:<br>
                <a href="${actionUrl}">${actionUrl}</a>
              </div>
            </div>
            <div class="footer">
              Sie haben diese Passwort-Änderung nicht in die Wege geleitet?<br>
              Dann können Sie diese E-Mail einfach ignorieren. Ihr aktuelles Passwort bleibt weiterhin gültig.<br>
              
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                <strong>AK Kommunal – Eine Marke der BW Partner Gruppe</strong><br>
                BW PARTNER Bauer Schätz Hasenclever Partnerschaft mbB<br>
                Hauptstraße 41, 70563 Stuttgart<br>
                Amtsgericht Stuttgart PR 720097 | USt-IdNr.: DE257068936<br>
                <a href="${baseUrl}/impressum" style="color: #94a3b8; text-decoration: underline;">Impressum</a> | <a href="${baseUrl}/datenschutz" style="color: #94a3b8; text-decoration: underline;">Datenschutz</a>
              </div>
            </div>
          </div>
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
