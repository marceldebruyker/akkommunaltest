import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: 'qsxzx8j0',
  dataset: 'production',
  // Use the public CDN for reads — Sanity's edge cache shaves ~100-200ms per
  // call. Drafts/preview reads should use a separate authenticated client.
  useCdn: true,
  apiVersion: '2024-03-01',
});

// In-memory TTL cache for frequently-read Sanity queries (seminar lists,
// homepage content). Each instance of the server holds its own cache; on
// Vercel that's per-region, which is fine for content that updates infrequently.
type CacheEntry = { value: unknown; expiresAt: number };
const queryCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function cachedSanityFetch<T = unknown>(
  query: string,
  params: Record<string, unknown> = {},
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const key = query + '\0' + JSON.stringify(params);
  const now = Date.now();
  const hit = queryCache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const value = await sanityClient.fetch<T>(query, params);
  queryCache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

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
