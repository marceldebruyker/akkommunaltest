import { createClient } from '@sanity/client';

export const sanityAdminClient = createClient({
  projectId: 'qsxzx8j0',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-03-01',
  token: process.env.SANITY_API_TOKEN || import.meta.env.SANITY_API_TOKEN,
});
