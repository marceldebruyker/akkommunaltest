import { getSupabaseServer } from '../../../lib/supabase';

export const POST = async ({ request, cookies }: any) => {
  const supabase = getSupabaseServer(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Admin Check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
     return new Response(JSON.stringify({ error: 'Forbidden: Admins only' }), { status: 403 });
  }

  try {
    const { topicId, isPinned } = await request.json();

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'Topic ID missing' }), { status: 400 });
    }

    const { error } = await supabase
      .from('forum_topics')
      .update({ is_pinned: isPinned })
      .eq('id', topicId);
        
    if (error) throw error;
    
    return new Response(JSON.stringify({ success: true, isPinned }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
