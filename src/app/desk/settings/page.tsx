import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBeirutParts, TIMEZONE } from "@/lib/schedule";
import { ImportExcelHistoryButton } from "./import-excel-button";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = getBeirutParts();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-slate-900">
        Settings
      </h1>
      <p className="mt-2 text-slate-600">
        Desk configuration for ETC attendance. Logins are managed by an admin
        under Accounts.
      </p>

      <dl className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-slate-500">Signed in as</dt>
          <dd className="sm:col-span-2 text-sm font-semibold text-slate-900">
            {session.username}
          </dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-slate-500">Timezone</dt>
          <dd className="sm:col-span-2 text-sm text-slate-900">{TIMEZONE}</dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-slate-500">Timeline hours</dt>
          <dd className="sm:col-span-2 text-sm text-slate-900">
            12:00 – 18:00 (covers all tutoring slots)
          </dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-slate-500">Schedule</dt>
          <dd className="sm:col-span-2 text-sm text-slate-900">
            Static weekly roster from Excel (seeded into{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">
              src/data/schedule.json
            </code>
            ). Update the file and redeploy to change the semester schedule.
          </dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm font-medium text-slate-500">Password</dt>
          <dd className="sm:col-span-2 text-sm text-slate-900">
            Ask an admin to change your password in{" "}
            <Link
              href="/admin/accounts"
              className="font-semibold text-emerald-700 underline"
            >
              Admin → Accounts
            </Link>
            .
          </dd>
        </div>
      </dl>

      <div className="mt-8">
        <ImportExcelHistoryButton />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/desk?date=${date}`}
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Back to desk
        </Link>
        <Link
          href="/desk/export"
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white"
        >
          Export Excel
        </Link>
      </div>
    </div>
  );
}
