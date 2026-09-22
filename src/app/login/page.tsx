import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
  description: "Sign in to ETC Desk or Admin",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  // Empty next lets loginAction send each role to its home (/admin or /desk).
  const next = params.next ?? "";

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-md surface-panel p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-base font-bold text-white">
              E
            </span>
            <span className="font-display text-2xl font-semibold text-ink">
              ETC
            </span>
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold text-ink">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-muted">
            Desk and admin accounts use this same door — you&apos;ll land in the
            right place.
          </p>
        </div>
        <LoginForm next={next} />
      </div>
      <p className="mt-8 text-center text-xs text-faint">By Julian Ibrahim</p>
    </div>
  );
}
