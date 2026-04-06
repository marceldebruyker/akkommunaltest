import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: 'qsxzx8j0',
  dataset: 'production',
  useCdn: false, // set to `false` to bypass the edge cache
  apiVersion: '2024-03-01', // use current date (YYYY-MM-DD) to target the latest API version
});
