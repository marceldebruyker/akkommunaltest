// All transactional / broadcast email HTML lives here so the API handlers
// stay focused on data orchestration. Each builder returns a self-contained
// HTML string ready to hand to Resend; share the chrome via `wrapInShell`.

const BRAND_NAVY = '#05183a';
const BRAND_FOOTER = `
  <strong>AK Kommunal &ndash; Eine Marke der BW Partner Gruppe</strong><br>
  BW PARTNER Bauer Schätz Hasenclever Partnerschaft mbB<br>
  Hauptstraße 41, 70563 Stuttgart<br>
  Amtsgericht Stuttgart PR 720097 | USt-IdNr.: DE257068936
`;

type ShellOpts = {
  origin: string;
  body: string;
  /** Extra paragraph between the body and the impressum (e.g. opt-out hint). */
  preFooter?: string;
};

function wrapInShell({ origin, body, preFooter }: ShellOpts): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color: ${BRAND_NAVY}; padding: 40px 20px; text-align: center;">
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
            ${body}
          </td>
        </tr>
        <tr>
          <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
            ${preFooter ?? ''}
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
              ${BRAND_FOOTER}<br>
              <a href="${origin}/impressum" style="color: #94a3b8; text-decoration: underline;">Impressum</a> | <a href="${origin}/datenschutz" style="color: #94a3b8; text-decoration: underline;">Datenschutz</a>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/** Build the salutation phrase used inside the body of every customer email. */
export function buildSalutation(meta: {
  salutation_string?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  if (meta.salutation_string) return ` ${meta.salutation_string},`;
  if (meta.first_name) {
    return ` ${meta.first_name} ${meta.last_name ?? ''},`.trim().replace(/,$/, ',');
  }
  return ' Sehr geehrte Damen und Herren,';
}

// ---------------------------------------------------------------------------
// Transactional emails
// ---------------------------------------------------------------------------

type PurchaseConfirmationOpts = {
  origin: string;
  salutation: string;
  itemListHtml: string;
  invoiceUrl?: string | null;
  paymentMethodLabel: string; // e.g. "Kreditkarte/Direktzahlung", "Kauf auf Rechnung"
};

export function purchaseConfirmationEmail(opts: PurchaseConfirmationOpts): { subject: string; html: string } {
  const invoiceBlock = opts.invoiceUrl
    ? `<div style="margin-top: 25px; padding: 15px; border-left: 3px solid ${BRAND_NAVY}; background-color: #f1f5f9;"><p style="margin: 0; font-size: 15px; color: #4b5563;">Rechnungsdokument (PDF): <br><a href="${opts.invoiceUrl}" style="color: ${BRAND_NAVY}; font-weight: 600; text-decoration: underline;">Hier können Sie Ihre offizielle Stripe-Rechnung herunterladen</a></p></div>`
    : '';

  const body = `
    <h2 style="color: ${BRAND_NAVY}; margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 700;">Vielen Dank für Ihre Buchung!</h2>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag${opts.salutation}<br><br>herzlichen Glückwunsch! Ihre Buchung (${opts.paymentMethodLabel}) war erfolgreich. Ihre Rechnung wurde von unserem System soeben separat für Sie generiert.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 12px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Ihre gebuchten Inhalte:</p>
          <ul style="margin: 0; color: #475569; padding-left: 20px; line-height: 1.6; font-size: 15px;">
            ${opts.itemListHtml}
          </ul>
          ${invoiceBlock}
        </td>
      </tr>
    </table>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">Ihre Weiterbildungsinhalte wurden Ihrem Konto zugewiesen und sind <strong>ab sofort</strong> in Ihrem persönlichen Dashboard für Sie abrufbar.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <a href="${opts.origin}/app/dashboard" style="display: inline-block; background-color: ${BRAND_NAVY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">Jetzt zum Fachportal</a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: 'Erfolgreiche Buchung',
    html: wrapInShell({ origin: opts.origin, body })
  };
}

// ---------------------------------------------------------------------------
// Broadcast emails (seminar invitations / Teams links)
// ---------------------------------------------------------------------------

type Seminar = {
  slug?: string;
  title: string;
  description?: string | unknown[];
  price?: number | null;
  teamsLink?: string | null;
};

function renderSeminarDescription(description: Seminar['description']): string {
  if (!description) return '';
  if (typeof description === 'string') {
    return `<div style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">${description.replace(/\n/g, '<br>')}</div>`;
  }
  if (!Array.isArray(description)) return '';
  const html = description
    .map((b: any) => {
      if (b._type !== 'block' || !b.children) return '';
      const text = b.children
        .map((c: any) => (c.marks && c.marks.length > 0 ? `<strong>${c.text}</strong>` : c.text))
        .join('');
      if (b.listItem === 'bullet') return `<li style="margin-left: 20px;">${text}</li>`;
      return `<p style="margin-bottom: 8px;">${text}</p>`;
    })
    .join('');
  return `<div style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">${html}</div>`;
}

type BroadcastOpts = {
  origin: string;
  salutation: string;
  seminar: Seminar;
  formattedDate: string;
  isMember: boolean;
};

const optOutFooter = `
  <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0; line-height: 1.5;">
    Sie möchten in Zukunft keine Seminarankündigungen von uns erhalten?<br>
    Bitte klicken Sie <a href="mailto:seminare@bw-partner.com?subject=Abmelden%20-%20Keine%20Einladungen" style="color: #3b82f6; text-decoration: underline;">hier zum Abmelden</a>.
  </p>
`;
const memberFooter = `
  <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0; line-height: 1.5;">
    Sie erhalten diese Nachricht als exklusives Serviceangebot für Mitglieder des Fachportals AK Kommunal.
  </p>
`;

export function ticketInvitationEmail(opts: BroadcastOpts): { subject: string; html: string } {
  const body = `
    <h2 style="color: ${BRAND_NAVY}; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Einladung zum Webinar</h2>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag${opts.salutation}<br><br>herzlich möchten wir Sie zu unserem nächsten Webinar <strong>„${opts.seminar.title}“</strong> einladen.</p>
    ${renderSeminarDescription(opts.seminar.description)}
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
      <tr><td style="padding: 20px;"><p style="margin: 0; color: #0f172a; font-weight: 700; font-size: 16px;">Termin: ${opts.formattedDate} Uhr</p></td></tr>
    </table>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">Die Teilnahmegebühr für das Webinar beträgt <strong>${opts.seminar.price ?? 260} Euro</strong> zuzüglich Umsatzsteuer.</p>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0; font-size: 15px;">Die Anmeldung für das Webinar können Sie gerne unter dem folgenden Link vornehmen:</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
      <tr><td align="center"><a href="${opts.origin}/termine/${opts.seminar.slug ?? ''}" style="display: inline-block; background-color: ${BRAND_NAVY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">Zur Anmeldung</a></td></tr>
    </table>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 14px; background-color: #f1f5f9; padding: 15px; border-radius: 8px;">Für Mitglieder des Arbeitskreises Kommunal ist die Teilnahme in der Jahresgebühr bereits enthalten (Spezialthemen-Modul oder Modul Gesamtpaket). Eine Anmeldung über den Link ist nicht erforderlich.</p>
    <p style="color: #4b5563; line-height: 1.6; margin: 0; font-size: 15px;">Wir freuen uns auf Ihre Anmeldung und Ihre Teilnahme an unserem Webinar.<br><br>Freundliche Grüße aus Stuttgart<br><br>i. A. Freya Marx<br>Assistentin<br><br><strong>BW PARTNER</strong><br>Telefon +49 711 1640 1650<br>E-Mail <a href="mailto:seminare@bw-partner.com" style="color: #3b82f6;">seminare@bw-partner.com</a></p>
  `;
  return {
    subject: `Einladung: Webinar „${opts.seminar.title}“`,
    html: wrapInShell({
      origin: opts.origin,
      body,
      preFooter: opts.isMember ? memberFooter : optOutFooter
    })
  };
}

export function teamsLinkEmail(opts: BroadcastOpts): { subject: string; html: string } {
  const body = `
    <h2 style="color: ${BRAND_NAVY}; margin-top: 0; margin-bottom: 20px; font-size: 20px;">Ihre Einwahldaten für das Live-Seminar</h2>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0; font-size: 16px;">Guten Tag${opts.salutation} <br><br>hiermit erhalten Sie offiziell den Einladungs-Link für Ihr folgendes Live-Seminar. Bitte treten Sie dem MS-Teams-Raum rechtzeitig am folgenden Termin bei:</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 10px 0; color: #0f172a; font-weight: 700; font-size: 16px;">${opts.seminar.title}</p>
          <p style="margin: 0; color: ${BRAND_NAVY}; font-weight: 600; font-size: 15px;">${opts.formattedDate} Uhr</p>
        </td>
      </tr>
    </table>
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr><td align="center"><a href="${opts.seminar.teamsLink ?? '#'}" style="display: inline-block; background-color: ${BRAND_NAVY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px;">Webinar beitreten</a></td></tr>
    </table>
    <p style="color: #4b5563; line-height: 1.6; margin: 30px 0 0 0; font-size: 14px;"><strong>Alternativ-Link:</strong> Falls der Button nicht funktioniert, kopieren Sie bitte folgenden Link:<br><br><span style="word-break: break-all; color: #94a3b8;">${opts.seminar.teamsLink ?? ''}</span></p>
  `;
  return {
    subject: `Ihre Einwahldaten: ${opts.seminar.title}`,
    html: wrapInShell({
      origin: opts.origin,
      body,
      preFooter: opts.isMember ? memberFooter : optOutFooter
    })
  };
}
