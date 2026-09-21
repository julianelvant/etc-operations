/**
 * One-shot / re-runnable Excel history import.
 * Usage: npx tsx scripts/import-excel-history.ts
 */
import { createClient } from "@supabase/supabase-js";
import { importAttendanceFromTemplate } from "../src/lib/excel-import";

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";
  if (!url || !key) {
    console.error("Missing Supabase URL / anon key in env");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const summary = await importAttendanceFromTemplate(
    supabase,
    "excel-import-script",
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
