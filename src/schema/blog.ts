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
      name: 'excerpt',
      title: 'Zusammenfassung (Kurz)',
      type: 'text',
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
