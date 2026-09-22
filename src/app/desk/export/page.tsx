import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBeirutParts } from "@/lib/schedule";
import { ExportForm } from "./export-form";

export const metadata: Metadata = {
  title: "Export",
};

export default async function ExportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = getBeirutParts();

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink">
        Export attendance
      </h1>
      <p className="mt-2 text-sm text-muted">
        Download an Excel workbook for any date range. Sheets match your
        template: General schedule, Tutors, Tutoree.
      </p>
      <div className="mt-8 surface-panel p-6">
        <ExportForm today={date} />
      </div>
    </div>
  );
}
