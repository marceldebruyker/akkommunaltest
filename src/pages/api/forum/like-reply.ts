import { getSupabaseServer } from '../../../lib/supabase';

export const POST = async ({ request, cookies }: any) => {
  const supabase = getSupabaseServer(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { replyId } = await request.json();

    if (!replyId) {
      return new Response(JSON.stringify({ error: 'Reply ID missing' }), { status: 400 });
    }

    // Prüfen ob der Like schon existiert
    const { data: existingLike } = await supabase
      .from('forum_reply_likes')
      .select('id')
      .eq('reply_id', replyId)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      // Unlike
      const { error } = await supabase
        .from('forum_reply_likes')
        .delete()
        .eq('id', existingLike.id);
        
      if (error) throw error;
      return new Response(JSON.stringify({ action: 'unliked' }), { status: 200 });
      
    } else {
      // Like
      const { error } = await supabase
        .from('forum_reply_likes')
        .insert({
          reply_id: replyId,
          user_id: user.id
        });
        
      if (error) throw error;
      return new Response(JSON.stringify({ action: 'liked' }), { status: 200 });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
