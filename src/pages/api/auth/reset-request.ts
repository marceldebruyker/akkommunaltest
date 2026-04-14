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
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 40px; }
            .container { background-color: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
            .header { background-color: #0a152e; padding: 30px 40px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
            .content { padding: 40px; color: #334155; line-height: 1.6; }
            .content h2 { margin-top: 0; color: #0f172a; font-size: 20px; }
            .button { display: inline-block; background-color: #0a152e; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 20px 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .footer { background-color: #f1f5f9; padding: 20px 40px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AK Kommunal Fachportal</h1>
            </div>
            <div class="content">
              <h2>Passwort zurücksetzen</h2>
              <p>Guten Tag,</p>
              <p>Es wurde eine Anfrage gestellt, um das Passwort für Ihr AK Kommunal Fachportal zurückzusetzen. Klicken Sie auf den folgenden Button, um ein neues Passwort zu vergeben:</p>
              <div style="text-align: center;">
                <a href="${actionUrl}" class="button">Neues Passwort vergeben</a>
              </div>
              <p style="font-size: 13px; color: #64748b; margin-top: 30px;">Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail sicher ignorieren. Ihr aktuelles Passwort bleibt bestehen.</p>
            </div>
            <div class="footer">
              <p>© 2026 AK Kommunal. Eine Marke der BW Partner Gruppe.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // 3. Send email!
      await resend.emails.send({
        from: 'AK Kommunal Fachportal <noreply@ak-kommunal.de>',
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
