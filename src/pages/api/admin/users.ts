import type { APIRoute } from 'astro';
import { getSupabaseServer, getSupabaseAdmin } from '../../../lib/supabase';

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
    // 1. Authenticate Request
    const supabaseSession = getSupabaseServer(request, cookies);
    const { data: { user }, error: authError } = await supabaseSession.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // 2. Authorize Admin Access
    const { data: adminProfile } = await supabaseSession
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfile?.is_admin !== true) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    // 3. Fetch comprehensive user payload via Admin API
    const supabaseAdmin = getSupabaseAdmin();

    // 3a. Auth Users
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // 3b. Profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('*');
    if (profilesError) throw profilesError;

    // 3c. Purchases
    const { data: purchases, error: purchasesError } = await supabaseAdmin
      .from('purchases')
      .select('*');
    if (purchasesError) throw purchasesError;

    // 4. Map everything together
    const finalUsers: AdminUserRecord[] = users.map(u => {
      const p = profiles.find(profile => profile.id === u.id);
      const uPurchases = purchases.filter(purchase => purchase.user_id === u.id).map(p => p.video_slug);

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
        purchases: uPurchases
      };
    });

    return new Response(JSON.stringify({ users: finalUsers }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (err: any) {
    console.error('Error fetching admin users:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
