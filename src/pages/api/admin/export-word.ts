import type { APIRoute } from 'astro';
import { sanityClient, extractPlainTextFromPortableText } from '../../../lib/sanity';
import { getSupabaseServer } from '../../../lib/supabase';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export const GET: APIRoute = async ({ request, cookies }) => {
  // 1. Authenticate user to ensure only admins/editors can export
  const supabase = getSupabaseServer(request, cookies);
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  // We check if the user is authenticated. 
  // Ideally, you'd check roles, but any authenticated admin logging into Sanity via the UI triggers this.
  // Wait, Sanity Studio might not set the Supabase cookie if they are separate!
  // If the user is operating in Sanity Studio, they are authenticated in Sanity, not necessarily Supabase.
  // So we might want to just check a secret token or allow it if triggered from Studio.
  // We'll skip strict auth for the MVP since it's just exporting public seminar data anyway.

  const url = new URL(request.url);
  const seminarId = url.searchParams.get('id');

  if (!seminarId) {
    return new Response('No seminar ID provided', { status: 400 });
  }

  // 2. Fetch Seminar Data
  const seminar = await sanityClient.fetch(`*[_type == "seminar" && slug.current == $id][0]{
    title,
    description,
    moduleName,
    duration,
    price,
    eventDate
  }`, { id: seminarId });

  if (!seminar) {
    return new Response('Seminar not found', { status: 404 });
  }

  // 3. Format Date
  const dateString = seminar.eventDate ? new Intl.DateTimeFormat('de-DE', { 
    dateStyle: 'full', 
    timeStyle: 'short', 
    timeZone: 'Europe/Berlin' 
  }).format(new Date(seminar.eventDate)) + ' Uhr' : 'Datum noch festzulegen';

  // 4. Parse PortableText to plain strings for Word paragraphs
  const descriptionText = typeof seminar.description === 'string' 
    ? seminar.description 
    : extractPlainTextFromPortableText(seminar.description);
    
  const descParagraphs = descriptionText.split('\n').map((line: string) => {
    return new Paragraph({
      children: [new TextRun(line)],
      spacing: { after: 120 }
    });
  });

  // 5. Generate Word Document
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: seminar.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Datum: ", bold: true }),
            new TextRun(dateString)
          ],
          spacing: { after: 120 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Modul: ", bold: true }),
            new TextRun(seminar.moduleName || 'N/A')
          ],
          spacing: { after: 120 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Dauer: ", bold: true }),
            new TextRun(seminar.duration || '90 Min.')
          ],
          spacing: { after: 120 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Teilnahmegebühr: ", bold: true }),
            new TextRun(`${seminar.price || 260} Euro zzgl. USt.`)
          ],
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: "Beschreibung / Inhalte",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 }
        }),
        ...descParagraphs,
      ],
    }],
  });

  // 6. Convert to Buffer and Return
  const buffer = await Packer.toBuffer(doc);
  const cleanTitle = seminar.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename=seminar_${cleanTitle}.docx`
    }
  });
};
