import { defineType, defineField } from 'sanity'

export const seminar = defineType({
  name: 'seminar',
  title: 'Seminare & Termine',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Titel des Seminars',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug (URL/Dauerhafte-ID)',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Beschreibung',
      type: 'text',
    }),
    defineField({
      name: 'moduleName',
      title: 'Modul Name (z.B. Spezialthemen Modul)',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'duration',
      title: 'Dauer (z.B. 120 Min.)',
      type: 'string',
    }),
    defineField({
      name: 'price',
      title: 'Preis (in €)',
      type: 'number',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Vorschaubild',
      type: 'image',
      options: {
        hotspot: true, // Erlaubt das Zuschneiden von Bildern per Drag-and-Drop im Studio
      },
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Live Event (Anstehend)', value: 'live' },
          { title: 'Aufzeichnung (Verfügbar)', value: 'aufzeichnung' },
        ],
        layout: 'radio',
      },
      initialValue: 'live',
    }),
    defineField({
      name: 'eventDate',
      title: 'Datum des Events',
      type: 'datetime',
      hidden: ({ document }) => document?.status !== 'live',
    }),
    defineField({
      name: 'teamsLink',
      title: 'MS Teams Link',
      type: 'url',
      hidden: ({ document }) => document?.status !== 'live',
    }),
    defineField({
      name: 'vimeoId',
      title: 'Vimeo Video ID (z.B. 823456789)',
      type: 'string',
      hidden: ({ document }) => document?.status !== 'aufzeichnung',
    }),
    defineField({
      name: 'badges',
      title: 'Badges (Kategorien)',
      type: 'array',
      of: [{ type: 'string' }],
    }),
  ],
})
