import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/apiAuth';
import { getSupabaseServer } from '../../../lib/supabase';

// Returns the video_slugs the current user has purchased. Used by the cart UI
// to hide items the user already owns (prevents accidental double-purchase).
export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireUser({ request, cookies });
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseServer(request, cookies);
  const { data, error } = await supabase
    .from('purchases')
    .select('video_slug')
    .eq('user_id', auth.user.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const slugs = Array.from(new Set((data ?? []).map(r => r.video_slug)));
  return new Response(JSON.stringify({ slugs }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
