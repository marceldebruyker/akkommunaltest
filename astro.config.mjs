// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

import sanity from '@sanity/astro';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    react(),
    sanity({
      projectId: 'qsxzx8j0',
      dataset: 'production',
      useCdn: false,
      studioBasePath: '/admin',
    }),
  ]
});