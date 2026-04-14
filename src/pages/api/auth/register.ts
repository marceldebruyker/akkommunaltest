import type { APIRoute } from "astro";
import { getSupabaseServer } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const firstName = formData.get("first_name")?.toString();
  const lastName = formData.get("last_name")?.toString();

  const anrede = formData.get("anrede")?.toString() || "Keine";

  if (!email || !password || !firstName || !lastName || !anrede) {
    return redirect("/register?error=Bitte füllen Sie alle Felder aus.");
  }

  // Pre-compute the exact salutation line for Supabase's template limits
  let salutationString = `${firstName} ${lastName}`;
  if (anrede === "Frau" || anrede === "Herr") {
    salutationString = `${anrede} ${lastName}`;
  }

  const supabase = getSupabaseServer(request, cookies);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        anrede: anrede,
        first_name: firstName,
        last_name: lastName,
        salutation_string: salutationString
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
