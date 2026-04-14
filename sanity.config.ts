import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/schema/index'
import { BroadcastEmailAction } from './src/sanity/actions/BroadcastEmailAction'
import { BroadcastInvitationAction } from './src/sanity/actions/BroadcastInvitationAction'
import { ExportWordAction } from './src/sanity/actions/ExportWordAction'

export default defineConfig({
  name: 'default',
  title: 'AK Kommunal',

  projectId: 'qsxzx8j0',
  dataset: 'production',
  basePath: '/admin',

  plugins: [structureTool()],

  schema: {
    types: schemaTypes,
  },

  document: {
    actions: (prev, context) => {
      // Only inject the custom buttons into 'seminar' types
      if (context.schemaType === 'seminar') {
        return [...prev, BroadcastInvitationAction, BroadcastEmailAction, ExportWordAction]
      }
      return prev
    }
  }
})
