import { redirect } from "next/navigation";
import Link from "next/link";
import { SessionHeartbeat } from "@/components/session-heartbeat";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getBeirutParts } from "@/lib/schedule";

export default async function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = getBeirutParts();

  return (
    <>
      <SessionHeartbeat />
      <AppShell
        product="desk"
        username={session.username}
        navItems={[
          { href: `/desk?date=${date}`, label: "Desk", match: "exact" },
          { href: "/desk/export", label: "Export", match: "prefix" },
          { href: "/desk/settings", label: "Settings", match: "prefix" },
        ]}
        headerExtra={
          session.role === "admin" ? (
            <Link
              href="/admin"
              className="hidden text-sm font-semibold text-brand-ink hover:underline focus-ring rounded md:inline"
            >
              Admin
            </Link>
          ) : null
        }
      >
        {children}
      </AppShell>
    </>
  );
}
