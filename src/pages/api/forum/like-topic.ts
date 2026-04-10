import { getSupabaseServer } from '../../../lib/supabase';

export const POST = async ({ request, cookies }: any) => {
  const supabase = getSupabaseServer(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { topicId } = await request.json();

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'Topic ID missing' }), { status: 400 });
    }

    // Prüfen ob der Like schon existiert
    const { data: existingLike } = await supabase
      .from('forum_topic_likes')
      .select('id')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .single();

    if (existingLike) {
      // Unlike (Löschen)
      const { error } = await supabase
        .from('forum_topic_likes')
        .delete()
        .eq('id', existingLike.id);
        
      if (error) throw error;
      return new Response(JSON.stringify({ action: 'unliked' }), { status: 200 });
      
    } else {
      // Like (Hinzufügen)
      const { error } = await supabase
        .from('forum_topic_likes')
        .insert({
          topic_id: topicId,
          user_id: user.id
        });
        
      if (error) throw error;
      return new Response(JSON.stringify({ action: 'liked' }), { status: 200 });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
