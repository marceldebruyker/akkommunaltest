import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    const { firstName, lastName, organisation, email, message } = data;
    
    if (!firstName || !lastName || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const customerName = `${firstName} ${lastName}`;
    const orgText = organisation ? `\nOrganisation/Kommune: ${organisation}` : '';

    // 1. Send Notification to AK Kommunal Admin
    await resend.emails.send({
      from: 'AK Kommunal System <anfragen@bw-partner.de>', // using generic bw-partner handle if no custom domain yet, otherwise a verified domain is required
      to: 'info@ak-kommunal.de',
      reply_to: email,
      subject: `Neue Kontaktanfrage von ${customerName}`,
      text: `Neue Anfrage über das Kontaktformular auf der Plattform:\n\nDetails:\n--------\nName: ${customerName}${orgText}\nE-Mail: ${email}\n\nNachricht:\n--------\n${message}`
    });

    // 2. Send Confirmation to User
    await resend.emails.send({
      from: 'AK Kommunal <anfragen@bw-partner.de>',
      to: email,
      subject: 'Ihre Anfrage bei AK Kommunal',
      text: `Guten Tag ${customerName},\n\nvielen Dank für Ihre Nachricht an AK Kommunal.\nWir haben Ihre Anfrage erfolgreich erhalten und werden uns schnellstmöglich bei Ihnen zurückmelden.\n\nIhre übermittelte Nachricht:\n"${message}"\n\nMit freundlichen Grüßen\nDas Team von AK Kommunal / BW PARTNER`
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Contact Form Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
