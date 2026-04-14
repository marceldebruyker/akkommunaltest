import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();
  const remember = formData.get('remember') === 'on';

  if (!email || !password) {
    return redirect('/login?error=Missing credentials');
  }

  const supabase = getSupabaseServer(request, cookies, remember);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Redirect back to login with error message
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const redirectParams = formData.get('redirect')?.toString();
  const finalRedirectUrl = redirectParams && redirectParams.startsWith('/') ? redirectParams : '/app/dashboard';

  // Successfully logged in, head to intended destination or dashboard
  return redirect(finalRedirectUrl);
};
