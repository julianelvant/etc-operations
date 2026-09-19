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
    <div className="mx-auto w-full max-w-xl px-6 py-10">
      <Link
        href={`/desk?date=${date}`}
        className="text-sm font-semibold text-emerald-700 hover:underline"
      >
        ← Back to desk
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold text-slate-900">
        Export attendance
      </h1>
      <p className="mt-2 text-slate-600">
        Download an Excel workbook for any date range. Sheets match your
        template: <strong>General schedule</strong>, <strong>Tutors</strong>,{" "}
        <strong>Tutoree</strong>.
      </p>
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <ExportForm today={date} />
      </div>
    </div>
  );
}
