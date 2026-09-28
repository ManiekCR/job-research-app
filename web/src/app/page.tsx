import { signOut } from "./auth-actions";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm underline">
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}