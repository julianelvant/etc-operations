import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isPersonRecurring,
  listCalendarRecurring,
} from "@/lib/calendar-recurring";
import {
  ensureTutorIdByName,
  resolveTutorIdByName,
  titleCaseName,
} from "@/lib/data-editor";
import {
  isPersonOnSchedule,
  loadScheduleDays,
} from "@/lib/schedule-roster";

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
  const patch: { active: boolean; courses?: string[] } = { active: true };

  if (courses.length > 0) {
    const { data: row } = await supabase
      .from("tutors")
      .select("courses")
      .eq("id", tutorId)
      .maybeSingle();

    patch.courses = mergeCourses(
      Array.isArray(row?.courses) ? row.courses : [],
      courses,
    );
  }

  await supabase.from("tutors").update(patch).eq("id", tutorId);
  return tutorId;
}

/** Rename the tutors row when a schedule/recurring name changes. */
export async function renameTutorByName(
  supabase: SupabaseClient,
  oldName: string,
  newName: string,
): Promise<void> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return;

  const tutorId = await resolveTutorIdByName(supabase, from);
  if (!tutorId) {
    await ensureTutorForPerson(supabase, to);
    return;
  }

  const { error } = await supabase
    .from("tutors")
    .update({ name: titleCaseName(to), active: true })
    .eq("id", tutorId);

  if (error) throw new Error(error.message);
}

/** Hide a tutor from desk search when they are no longer on the roster or recurring list. */
export async function deactivateTutorIfOffSchedule(
  supabase: SupabaseClient,
  name: string,
): Promise<void> {
  const key = name.trim().toLowerCase();
  if (!key) return;

  const [onRoster, onRecurring] = await Promise.all([
    isPersonOnSchedule(supabase, name),
    isPersonRecurring(supabase, name),
  ]);
  if (onRoster || onRecurring) return;

  const tutorId = await resolveTutorIdByName(supabase, name);
  if (!tutorId) return;

  await supabase.from("tutors").update({ active: false }).eq("id", tutorId);
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
