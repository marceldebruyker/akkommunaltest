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
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'moduleName',
      title: 'Modul Name (Dropdown)',
      type: 'string',
      options: {
        list: [
          { title: 'Grundlagen Modul', value: 'Grundlagen Modul' },
          { title: 'Spezialthemen Modul', value: 'Spezialthemen Modul' },
          { title: 'Praktiker Modul', value: 'Praktiker Modul' },
        ],
        layout: 'dropdown',
      },
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
      name: 'bunnyVideoId',
      title: 'Bunny.net Video ID',
      description: 'Hier nur die Video-ID von Bunny.net einkopieren (z.B. d8823651-5329-4ec3-8661-5155ed33f983)',
      type: 'string',
      hidden: ({ document }) => document?.status !== 'aufzeichnung',
    }),
    defineField({
      name: 'badges',
      title: 'Badges (Kategorien)',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'materials',
      title: 'Kursunterlagen (PDFs)',
      description: 'Hier können begleitende Dateien (, Präsentationen, Skripte) hochgeladen werden. Diese tauchen in der persönlichen Lernwelt der Käufer auf.',
      type: 'array',
      of: [{ 
        type: 'file',
        options: {
          storeOriginalFilename: true
        }
      }],
    }),
    defineField({
      name: 'validUntil',
      title: 'Verfügbar bis (Ablaufdatum)',
      description: 'Optional: Bis zu welchem Datum steht das Video / die Aufzeichnung den Kunden zur Verfügung?',
      type: 'date',
      options: {
        dateFormat: 'DD.MM.YYYY',
      }
    }),
  ],
})
