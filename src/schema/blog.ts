import { defineType, defineField } from 'sanity'

export const blog = defineType({
  name: 'post',
  title: 'Blog / Aktuelles',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Überschrift',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
    }),
    defineField({
      name: 'publishedAt',
      title: 'Veröffentlichungsdatum',
      type: 'datetime',
    }),
    defineField({
      name: 'category',
      title: 'Kategorie',
      type: 'string',
      options: {
        list: [
          { title: 'Umsatzsteuer & § 2b UStG', value: 'Umsatzsteuer & § 2b UStG' },
          { title: 'Ertragsteuern', value: 'Ertragsteuern' },
          { title: 'Tax CMS', value: 'Tax CMS' },
          { title: 'Jahresabschluss & Rechnungswesen', value: 'Jahresabschluss & Rechnungswesen' },
          { title: 'Energie & Nachhaltigkeit', value: 'Energie & Nachhaltigkeit' },
          { title: 'IT & Datensicherheit', value: 'IT & Datensicherheit' },
          { title: 'Rechtsprechung (Allgemein)', value: 'Rechtsprechung (Allgemein)' },
          { title: 'Event / Event-Rückblick', value: 'Event / Event-Rückblick' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Zusammenfassung (Kurz)',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [{ title: 'Normal', value: 'normal' }],
          lists: [],
          marks: {
            decorators: [
              { title: 'Fett', value: 'strong' },
              { title: 'Kursiv', value: 'em' },
            ],
            annotations: [],
          },
        },
      ],
    }),
    defineField({
      name: 'mainImage',
      title: 'Hauptbild',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'body',
      title: 'Text-Inhalt',
      type: 'array',
      of: [{ type: 'block' }],
    }),
  ],
})
