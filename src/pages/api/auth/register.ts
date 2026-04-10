import type { APIRoute } from "astro";
import { getSupabaseServer } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const firstName = formData.get("first_name")?.toString();
  const lastName = formData.get("last_name")?.toString();

  if (!email || !password || !firstName || !lastName) {
    return redirect("/register?error=Bitte füllen Sie alle Felder aus.");
  }

  const supabase = getSupabaseServer(request, cookies);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    return redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  // If session is created directly, user is logged in
  if (data.session) {
    return redirect("/app/dashboard");
  }

  // If no session but data.user exists, Supabase requires email verification
  if (data.user) {
    return redirect("/login?message=check_email");
  }

  return redirect("/login");
};
