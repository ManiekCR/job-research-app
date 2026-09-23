import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        action={login}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Connexion
        </h1>
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        />
        <input
          name="password"
          type="password"
          placeholder="Mot de passe"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        />
        <button
          type="submit"
          className="rounded bg-foreground px-3 py-2 text-background"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}