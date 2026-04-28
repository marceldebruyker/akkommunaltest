import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { requireAdmin } from '../../../lib/apiAuth';
import { logger } from '../../../lib/logger';

// Helper interface for return type
export interface AdminUserRecord {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  salutation_string?: string;
  created_at: string;
  is_admin: boolean;
  is_partner: boolean;
  has_membership: boolean;
  purchases: string[];
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await requireAdmin({ request, cookies });
    if (!auth.ok) return auth.response;

    // Fetch comprehensive user payload via Admin API.
    // auth.users lives in a separate Postgres schema served by GoTrue's admin API,
    // so we cannot do a single SQL join with user_profiles/purchases. We do three
    // round-trips in parallel, then join in-memory via Maps (O(N) instead of O(N*M)).
    const supabaseAdmin = getSupabaseAdmin();

    const [usersRes, profilesRes, purchasesRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from('user_profiles').select('id, is_admin, is_partner, has_membership'),
      supabaseAdmin.from('purchases').select('user_id, video_slug')
    ]);

    if (usersRes.error) throw usersRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (purchasesRes.error) throw purchasesRes.error;

    const profileById = new Map(
      (profilesRes.data ?? []).map(p => [p.id, p])
    );
    const purchasesByUser = new Map<string, string[]>();
    for (const row of purchasesRes.data ?? []) {
      const list = purchasesByUser.get(row.user_id) ?? [];
      list.push(row.video_slug);
      purchasesByUser.set(row.user_id, list);
    }

    const finalUsers: AdminUserRecord[] = usersRes.data.users.map(u => {
      const p = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email || '',
        first_name: u.user_metadata?.first_name || '',
        last_name: u.user_metadata?.last_name || '',
        salutation_string: u.user_metadata?.salutation_string || '',
        created_at: u.created_at,
        is_admin: p?.is_admin || false,
        is_partner: p?.is_partner || false,
        has_membership: p?.has_membership || false,
        purchases: purchasesByUser.get(u.id) ?? []
      };
    });

    return new Response(JSON.stringify({ users: finalUsers }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Error fetching admin users', { error: msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
};
