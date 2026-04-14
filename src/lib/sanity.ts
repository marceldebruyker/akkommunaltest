import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: 'qsxzx8j0',
  dataset: 'production',
  useCdn: false, // set to `false` to bypass the edge cache
  apiVersion: '2024-03-01', // use current date (YYYY-MM-DD) to target the latest API version
});

// Helper to reliably extract plain string previews from PortableText arrays
export function extractPlainTextFromPortableText(blocks: any) {
  if (!blocks) return '';
  if (typeof blocks === 'string') return blocks;
  if (!Array.isArray(blocks)) return '';
  return blocks
    .filter((block: any) => block._type === 'block' && block.children)
    .map((block: any) => block.children.map((child: any) => child.text).join(''))
    .join(' ');
}
