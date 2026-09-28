import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ScheduleClient } from "./schedule-client";

export const metadata: Metadata = {
  title: "Schedule",
};

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <ScheduleClient />;
}
