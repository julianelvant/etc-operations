import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { SessionHeartbeat } from "@/components/session-heartbeat";
import { getSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/desk");

  return (
    <div className="relative min-h-full bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f3f5f7_45%,_#eef2f6_100%)]">
      <SessionHeartbeat />
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-800 text-sm font-bold text-white shadow-sm">
              E
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-tight text-slate-900">
                ETC Admin
              </p>
              <p className="text-xs text-slate-500">Operations overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline"
            >
              Overview
            </Link>
            <Link
              href="/admin/accounts"
              className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline"
            >
              Accounts
            </Link>
            <Link
              href="/desk"
              className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 md:inline"
            >
              Open desk
            </Link>
            <Link
              href="/desk/export"
              className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:inline"
            >
              Export
            </Link>
            <span className="text-sm text-slate-500">{session.username}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">{children}</main>
    </div>
  );
}
