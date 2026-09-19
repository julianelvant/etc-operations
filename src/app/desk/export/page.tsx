import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBeirutParts } from "@/lib/schedule";
import { ExportForm } from "./export-form";

export default async function ExportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = getBeirutParts();

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 via-white to-emerald-50">
      <div className="mx-auto max-w-xl px-6 py-12">
        <Link
          href="/desk"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
        >
          ← Back to desk
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold text-slate-900">
          Export attendance
        </h1>
        <p className="mt-2 text-slate-600">
          Choose a date range. The download matches your Excel template sheets.
        </p>
        <ExportForm today={date} />
      </div>
    </div>
  );
}
