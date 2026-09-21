import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  // Empty next lets loginAction send each role to its home (/admin or /desk).
  const next = params.next ?? "";

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-emerald-50 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl shadow-emerald-100/40">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            ETC Operations
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-slate-900">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Desk and admin accounts use this same door — you&apos;ll land in the
            right place.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
      <p className="mt-8 text-center text-[11px] text-slate-400">
        By Julian Ibrahim
      </p>
    </div>
  );
}
