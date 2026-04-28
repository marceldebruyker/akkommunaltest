import type { APIRoute } from 'astro';
import { sanityClient, extractPlainTextFromPortableText } from '../../../lib/sanity';
import { requireAdmin } from '../../../lib/apiAuth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin({ request, cookies });
  if (!auth.ok) return auth.response;

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

  // 6. Convert to Buffer and Return.
  // Node Buffer is not in DOM BodyInit; wrap the bytes in a Uint8Array, which
  // Web Response accepts and never widens to SharedArrayBuffer.
  const nodeBuffer = await Packer.toBuffer(doc);
  const bytes = new Uint8Array(nodeBuffer);
  const cleanTitle = seminar.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename=seminar_${cleanTitle}.docx`
    }
  });
};
