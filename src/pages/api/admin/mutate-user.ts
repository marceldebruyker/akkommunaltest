import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabase';
import { requireAdmin } from '../../../lib/apiAuth';
import { logger } from '../../../lib/logger';
import { Buffer } from 'node:buffer';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await requireAdmin({ request, cookies });
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { targetUserId, action, payload } = body;

    if (!targetUserId || !action) {
      return new Response(JSON.stringify({ error: 'Missing target user or action' }), { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    switch (action) {
      case 'UPDATE_ROLE': {
        // Update user_profiles (is_admin, is_partner, has_membership)
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            ...(payload.is_admin !== undefined && { is_admin: payload.is_admin }),
            ...(payload.is_partner !== undefined && { is_partner: payload.is_partner }),
            ...(payload.has_membership !== undefined && { has_membership: payload.has_membership })
          })
          .eq('id', targetUserId);

        if (profileError) throw profileError;

        // If they granted the partner role, push the current profile to Sanity
        if (payload.is_partner === true) {
          try {
             // Dynamic import to avoid loading Sanity globally if not needed
             const { sanityAdminClient } = await import('../../../lib/sanityAdmin');
             const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
             
             if (targetUser) {
                const meta = targetUser.user_metadata || {};
                
                let sanityImageId = undefined;
                if (meta.avatar_url) {
                  const imgRes = await fetch(meta.avatar_url);
                  if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer();
                    // we use explicit Buffer.from inside the sanity api
                    const asset = await sanityAdminClient.assets.upload('image', Buffer.from(buffer), { filename: `avatar-${targetUserId}.jpg` });
                    sanityImageId = asset._id;
                  }
                }
                
                const sanityDoc: any = {
                  _id: `team-${targetUserId}`,
                  _type: 'team',
                  name: `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || targetUser.email,
                  role: meta.job_description || '',
                  sortIndex: 99
                };
                
                if (sanityImageId) {
                  sanityDoc.image = { _type: 'image', asset: { _type: 'reference', _ref: sanityImageId } };
                }
                
                await sanityAdminClient.createOrReplace(sanityDoc);
             }
          } catch (e) {
             logger.error('[Admin Sanity Sync Error]', { error: e instanceof Error ? e.message : String(e) });
          }
        }
        break;
      }

      case 'GRANT_SLUG': {
        if (!payload.slug) throw new Error('Missing slug in payload');
        const { data: existing } = await supabaseAdmin
          .from('purchases')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('video_slug', payload.slug)
          .single();

        if (!existing) {
          const { error: grantErr } = await supabaseAdmin
            .from('purchases')
            .insert({ user_id: targetUserId, video_slug: payload.slug });
          if (grantErr) throw grantErr;
        }
        break;
      }

      case 'REVOKE_SLUG': {
        if (!payload.slug) throw new Error('Missing slug in payload');
        const { error: revokeErr } = await supabaseAdmin
          .from('purchases')
          .delete()
          .eq('user_id', targetUserId)
          .eq('video_slug', payload.slug);
        if (revokeErr) throw revokeErr;
        break;
      }

      case 'RESEND_RESET_PASSWORD': {
        // Supabase can email the recovery link itself; we just need to mint it.
        const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: payload.email
        });
        if (linkErr) throw linkErr;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Error mutating user', { error: msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
};
