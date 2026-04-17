import { getSupabaseServer } from '../../../lib/supabase';

export const POST = async ({ request, cookies }: any) => {
  const supabase = getSupabaseServer(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Admin / Partner Check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_admin, is_partner')
    .eq('id', user.id)
    .single();

  if (!profile || (!profile.is_admin && !profile.is_partner && profile.role !== 'admin')) {
     return new Response(JSON.stringify({ error: 'Forbidden: Admins & Partners only' }), { status: 403 });
  }

  try {
    const { topicId } = await request.json();

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'Topic ID missing' }), { status: 400 });
    }

    const { error } = await supabase
      .from('forum_topics')
      .delete()
      .eq('id', topicId);
        
    if (error) throw error;
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
