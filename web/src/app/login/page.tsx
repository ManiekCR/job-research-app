import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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

    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-7 bg-bg p-4">
      <form action={login} className="card flex w-full max-w-[400px] flex-col gap-[22px] !rounded-2xl p-6 shadow-pop sm:p-9">
        <div className="flex flex-col gap-[18px]">
          <div className="font-heading flex h-10 w-10 items-center justify-center rounded-[11px] bg-accent text-sm font-bold tracking-normal text-on-accent">
            HQ
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading m-0 text-2xl font-semibold leading-8 tracking-[-0.02em]">
              Sign in to Job Search HQ
            </h1>
            <p className="m-0 text-sm text-text-2">Your private job search workspace.</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="alert alert-bad">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="label">Email</span>
          <input name="email" type="email" autoComplete="email" required className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
          />
        </label>
        <button type="submit" className="btn btn-primary w-full">
          Sign in
        </button>
      </form>
      <span className="caption">Single-user workspace · sign-ups are disabled</span>
    </main>
  );
}
