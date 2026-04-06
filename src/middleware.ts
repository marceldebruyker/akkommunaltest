import { defineMiddleware } from 'astro:middleware';
import { getSupabaseServer } from './lib/supabase';

// Paths that require an active Supabase session
const protectedRoutes = ['/app/lernwelt', '/app/dashboard', '/app/verwalten'];

export const onRequest = defineMiddleware(async ({ request, cookies, redirect, url }, next) => {
  if (protectedRoutes.some(route => url.pathname.startsWith(route))) {
    // Reconstruct the SSR client to automatically read the HTTP-Only cookies
    const supabase = getSupabaseServer(request, cookies);
    
    // Validate the session against the Supabase backend
    const { data: { user }, error } = await supabase.auth.getUser();

    // If no valid session exists, bounce the user back to the login wall
    if (!user || error) {
      return redirect('/login');
    }
  }
  
  // Proceed with the request
  return next();
});
