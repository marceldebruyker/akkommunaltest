import 'dotenv/config';
import { Resend } from 'resend';

// Hole den Schlüssel aus der .env Datei
const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  console.log("Versuche E-Mail zu senden...");
  
  if (!process.env.RESEND_API_KEY) {
    console.error("FEHLER: Keine RESEND_API_KEY in der .env Datei gefunden!");
    return;
  }

  try {
    const data = await resend.emails.send({
      from: 'AK Kommunal Test <onboarding@resend.dev>',
      to: ['marceldebruyker@gmail.com'], 
      subject: 'Einladung: Tax CMS Testlauf 2026',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #05183a; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">AK Kommunal Plattform</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #05183a; margin-top: 0;">Einladung zur Live-Session</h2>
            <p style="color: #4b5563; line-height: 1.6;">Guten Tag, <br><br>Sie sind herzlich eingeladen zu unserer kommenden Experten-Session <strong>"Tax CMS Testlauf 2026"</strong>.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #374151;"><strong>Wann:</strong> 26. Mai 2026, 14:00 Uhr</p>
              <p style="margin: 5px 0 0 0; color: #374151;"><strong>Wo:</strong> MS Teams (Link folgt am Tag der Veranstaltung)</p>
            </div>

            <a href="http://localhost:4321/app/dashboard" style="display: inline-block; background-color: #05183a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Zum Fachportal</a>
          </div>
          <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; 2026 BW Partner. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      `,
    });

    console.log("ERFOLG! E-Mail wurde verschickt. ID:", data.id);
  } catch (error) {
    console.error("FEHLER beim Versenden:", error);
  }
}

testEmail();
