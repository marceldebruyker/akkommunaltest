import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/schema/index'

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
})
