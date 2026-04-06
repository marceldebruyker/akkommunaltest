import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = getSupabaseServer(request, cookies);
  await supabase.auth.signOut();
  return redirect('/');
};
