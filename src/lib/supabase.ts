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
export const getSupabaseServer = (request: Request, cookies: AstroCookies, remember: boolean = true) => {
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
          let finalOptions = { ...options, path: '/' };
          
          if (!remember) {
            // pure session cookie (expires when browser is closed)
            delete finalOptions.maxAge;
            delete finalOptions.expires;
          } else {
            // explicitly 30 days persistence
            finalOptions.maxAge = 60 * 60 * 24 * 30;
            finalOptions.expires = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);
          }

          cookies.set(name, value, finalOptions);
        });
      },
    },
  });
};

// 3. Admin Client (used exclusively in secure Server / API endpoints for bypassing RLS / sending emails)
export const getSupabaseAdmin = () => {
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
