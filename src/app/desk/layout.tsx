import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { SessionHeartbeat } from "@/components/session-heartbeat";
import { getSession } from "@/lib/auth/session";
import { getBeirutParts } from "@/lib/schedule";
import { DeskNav } from "./desk-nav";

export default async function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = getBeirutParts();

  return (
    <div className="flex min-h-full flex-col bg-[#f3f5f7]">
      <SessionHeartbeat />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-6">
            <Link href={`/desk?date=${date}`} className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                E
              </span>
              <span className="font-display text-lg font-semibold text-slate-900">
                ETC Desk
              </span>
            </Link>
            <div className="hidden sm:block">
              <DeskNav today={date} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session.role === "admin" ? (
              <Link
                href="/admin"
                className="hidden text-sm font-semibold text-emerald-700 hover:underline md:inline"
              >
                Admin
              </Link>
            ) : null}
            <span className="hidden text-sm text-slate-500 md:inline">
              {session.username}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
        <div className="sm:hidden">
          <DeskNav today={date} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}
