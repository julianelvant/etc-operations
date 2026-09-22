import { redirect } from "next/navigation";
import { SessionHeartbeat } from "@/components/session-heartbeat";
import { AppShell } from "@/components/app-shell";
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
    <>
      <SessionHeartbeat />
      <AppShell
        product="admin"
        username={session.username}
        contained
        navItems={[
          { href: "/admin", label: "Overview", match: "exact" },
          { href: "/admin/accounts", label: "Accounts", match: "prefix" },
          { href: "/desk", label: "Desk", match: "prefix" },
          { href: "/desk/export", label: "Export", match: "prefix" },
        ]}
      >
        {children}
      </AppShell>
    </>
  );
}
