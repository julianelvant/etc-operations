/**
 * Wipe attendance + visits, then import tutors-history.csv.
 * Usage: npx tsx scripts/replace-tutors-from-csv.ts [path-to-csv]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importTutorsCsvReplaceAll } from "../src/lib/excel-import";

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";
  if (!url || !key) {
    console.error("Missing Supabase URL / service role key in env");
    process.exit(1);
  }

  const csvPath =
    process.argv[2] ??
    path.join(process.cwd(), "src", "data", "tutors-history.csv");
  const csv = await readFile(csvPath, "utf8");
  const supabase = createClient(url, key);
  const summary = await importTutorsCsvReplaceAll(
    supabase,
    csv,
    "csv-replace-script",
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
