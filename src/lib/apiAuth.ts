import type { AstroCookies } from 'astro';
import type { User } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase';

type Ctx = { request: Request; cookies: AstroCookies };

export type AuthSuccess = { ok: true; user: User };
export type AuthFailure = { ok: false; response: Response };
export type AuthResult = AuthSuccess | AuthFailure;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

/**
 * Resolves the current Supabase user from cookies, or returns a 401 Response.
 * Use:
 *   const auth = await requireUser(ctx);
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;
 */
export async function requireUser(ctx: Ctx): Promise<AuthResult> {
  const supabase = getSupabaseServer(ctx.request, ctx.cookies);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: json({ error: 'Unauthorized' }, 401) };
  }
  return { ok: true, user };
}

/**
 * Like requireUser, but additionally checks user_profiles.is_admin = true.
 * Returns 401 (no session) or 403 (session but not admin).
 */
export async function requireAdmin(ctx: Ctx): Promise<AuthResult> {
  const supabase = getSupabaseServer(ctx.request, ctx.cookies);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: json({ error: 'Unauthorized' }, 401) };
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (profile?.is_admin !== true) {
    return { ok: false, response: json({ error: 'Forbidden' }, 403) };
  }
  return { ok: true, user };
}
