import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBeirutParts, TIMEZONE } from "@/lib/schedule";
import { ImportExcelHistoryButton } from "./import-excel-button";
import { DataDurabilityPanel } from "./data-durability-panel";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = getBeirutParts();
  const isAdmin = session.role === "admin";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
      <p className="mt-2 text-sm text-muted">
        Desk configuration for ETC attendance.
      </p>

      <dl className="mt-8 divide-y divide-border overflow-hidden surface-panel">
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-muted">Signed in as</dt>
          <dd className="sm:col-span-2 text-sm font-semibold text-ink">
            {session.username}
            {isAdmin ? (
              <span className="ml-2 text-xs font-medium text-muted">(admin)</span>
            ) : null}
          </dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-muted">Timezone</dt>
          <dd className="sm:col-span-2 text-sm text-ink">{TIMEZONE}</dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-muted">Timeline hours</dt>
          <dd className="sm:col-span-2 text-sm text-ink">
            12:00 – 18:00 (covers all tutoring slots)
          </dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-muted">Schedule</dt>
          <dd className="sm:col-span-2 text-sm text-ink">
            Weekly roster from{" "}
            <code className="rounded bg-bg px-1 text-xs">schedule.json</code>.
            Update the file and redeploy to change the semester schedule.
          </dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-muted">Password</dt>
          <dd className="sm:col-span-2 text-sm text-ink">
            {isAdmin ? (
              <>
                Manage passwords in{" "}
                <Link
                  href="/admin/accounts"
                  className="font-semibold text-brand-ink underline focus-ring rounded"
                >
                  Admin → Accounts
                </Link>
                .
              </>
            ) : (
              <>Ask an admin to change your password.</>
            )}
          </dd>
        </div>
      </dl>

      {isAdmin ? (
        <div className="mt-8 space-y-8">
          <DataDurabilityPanel />
          <ImportExcelHistoryButton />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/desk?date=${date}`} className="btn-primary">
          Back to desk
        </Link>
        <Link href="/desk/export" className="btn-secondary">
          Export Excel
        </Link>
      </div>
    </div>
  );
}
