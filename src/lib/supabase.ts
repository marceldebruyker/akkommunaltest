import { createClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase Credentials Missing in .env');
}

// 1. Standard Client (used directly in React/Client-side logic where window exists)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. SSR Server Client (used in Astro Middleware, API endpoints, and Astro component frontmatter)
export const getSupabaseServer = (request: Request, cookies: AstroCookies) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const parsed = parseCookieHeader(request.headers.get('Cookie') ?? '');
        return parsed.map(cookie => ({
          name: cookie.name,
          value: cookie.value ?? ''
        }));
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            path: '/',
          });
        });
      },
    },
  });
};
