import { defineType, defineField } from 'sanity'

export const team = defineType({
  name: 'team',
  title: 'Team Mitglieder',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
    }),
    defineField({
      name: 'role',
      title: 'Rolle / Position',
      type: 'string',
    }),
    defineField({
      name: 'image',
      title: 'Profilbild',
      type: 'image',
      options: { hotspot: true },
    }),
  ],
})
