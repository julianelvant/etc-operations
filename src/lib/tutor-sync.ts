import type { SupabaseClient } from "@supabase/supabase-js";
import { listCalendarRecurring } from "@/lib/calendar-recurring";
import { ensureTutorIdByName } from "@/lib/data-editor";
import { loadScheduleDays } from "@/lib/schedule-roster";

function mergeCourses(existing: string[], next: string[]): string[] {
  return Array.from(
    new Set([...existing, ...next].map((c) => c.trim()).filter(Boolean)),
  ).sort();
}

/** Ensure a tutors row exists for someone on the schedule or recurring list. */
export async function ensureTutorForPerson(
  supabase: SupabaseClient,
  name: string,
  courses: string[] = [],
): Promise<string> {
  const tutorId = await ensureTutorIdByName(supabase, name);
  if (courses.length === 0) return tutorId;

  const { data: row } = await supabase
    .from("tutors")
    .select("courses")
    .eq("id", tutorId)
    .maybeSingle();

  const merged = mergeCourses(
    Array.isArray(row?.courses) ? row.courses : [],
    courses,
  );
  if (merged.length === 0) return tutorId;

  await supabase.from("tutors").update({ courses: merged }).eq("id", tutorId);
  return tutorId;
}

/** Create missing tutors rows for everyone on the live roster + recurring list. */
export async function syncSchedulePeopleToTutors(
  supabase: SupabaseClient,
): Promise<void> {
  const [days, recurring] = await Promise.all([
    loadScheduleDays(supabase),
    listCalendarRecurring(supabase, { activeOnly: true }),
  ]);

  const people = new Map<string, { name: string; courses: string[] }>();

  for (const daySlots of Object.values(days)) {
    for (const slotPeople of Object.values(daySlots)) {
      for (const person of slotPeople) {
        const key = person.name.toLowerCase();
        const existing = people.get(key);
        if (existing) {
          existing.courses = mergeCourses(existing.courses, person.courses);
        } else {
          people.set(key, { name: person.name, courses: [...person.courses] });
        }
      }
    }
  }

  for (const row of recurring) {
    const key = row.display_name.toLowerCase();
    const existing = people.get(key);
    if (existing) {
      existing.courses = mergeCourses(existing.courses, row.courses);
    } else {
      people.set(key, {
        name: row.display_name,
        courses: [...row.courses],
      });
    }
  }

  for (const { name, courses } of people.values()) {
    await ensureTutorForPerson(supabase, name, courses);
  }
}
