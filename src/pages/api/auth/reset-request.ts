import type { APIRoute } from "astro";
import { getSupabaseServer } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();

  if (!email) {
    return redirect("/passwort-vergessen?error=" + encodeURIComponent("Bitte geben Sie eine gültige E-Mail-Adresse ein."));
  }

  const supabase = getSupabaseServer(request, cookies);

  // Generiere die Basis-URL dynamisch (z.B. http://localhost:4321 oder https://ak-kommunal.de)
  const baseUrl = new URL(request.url).origin;
  
  // Wir leiten Supabase an, den Nutzer nach dem Klick im E-Mail-Postfach auf diese Route zu schicken.
  // WICHTIG: Die URL (baseUrl) muss im Supabase Dashboard als zulässige Redirect-URL eingetragen sein.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/passwort-aendern`,
  });

  if (error) {
    return redirect(`/passwort-vergessen?error=${encodeURIComponent('Verbindungsfehler: Das Senden der E-Mail ist fehlgeschlagen.')}`);
  }

  // Security Note: Wir geben hier absichtlich keine Auskunft darüber, ob die E-Mail existiert, 
  // um User-Enumeration (Herausfinden fremder E-Mails) zu verhindern. Wir schicken einfach success.
  return redirect("/passwort-vergessen?success=true");
};
