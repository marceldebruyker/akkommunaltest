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
    defineField({
      name: 'sortIndex',
      title: 'Sortierung (Aufsteigend)',
      type: 'number',
      description: 'Zahl für die Reihenfolge auf der Website (z.B. 1 für den ersten, 2 für den zweiten).',
    }),
  ],
  orderings: [
    {
      title: 'Website Sortierung',
      name: 'sortIndexAsc',
      by: [
        { field: 'sortIndex', direction: 'asc' }
      ]
    }
  ]
})
