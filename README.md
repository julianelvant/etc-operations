# ETC Operations — Attendance Desk

Tutor check-in and student visit logging for the Engineering Tutoring Center, matching the Excel attendance workflow.

## Stack

- Next.js (App Router) on Vercel
- Supabase (tutors, attendance, student visits)
- Static weekly schedule seeded from the Excel general schedule
- Desk login (shared staff credentials)

## Local development

1. Copy `.env.example` to `.env.local` and fill in values.
2. `npm install`
3. `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) → login → desk

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `ATTENDANCE_USERNAME` | Desk login username (default `desk`) |
| `ATTENDANCE_PASSWORD` | Desk login password (required) |
| `SESSION_SECRET` | Secret for signing session cookies |

## Desk flow

1. Sign in with staff credentials
2. Today’s schedule is prefilled — check tutors in/out with one tap
3. Log student visits linked to a tutor (course + notes)
4. Export a date range to Excel (General schedule / Tutors / Tutoree sheets)

## Health

`GET /api/health` — app + Supabase connectivity
