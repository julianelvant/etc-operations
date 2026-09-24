import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getBeirutParts } from "@/lib/schedule";
import { SpreadsheetClient } from "./spreadsheet-client";

export const metadata: Metadata = {
  title: "Data editor",
};

export default async function DataEditorPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = getBeirutParts();

  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 py-8 lg:px-8">
      <h1 className="font-display text-2xl font-semibold text-ink">
        Data editor
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Spreadsheet view of tutor attendance and student visits — same columns as
        the Excel export. Edit freely, add or remove rows, and save any time.
        New tutor names are created automatically; everything stays linked to
        the desk and export.
      </p>
      <div className="mt-8">
        <SpreadsheetClient today={date} />
      </div>
    </div>
  );
}
