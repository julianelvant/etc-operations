import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/desk";

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-gradient-to-b from-slate-50 via-white to-emerald-50 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl shadow-emerald-100/40">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            ETC Operations
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-slate-900">
            Desk login
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to check tutors in and log student visits.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
