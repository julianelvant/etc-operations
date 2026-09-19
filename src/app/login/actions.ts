"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  createSessionToken,
  getDeskCredentials,
  setSessionCookie,
} from "@/lib/auth/session";

export async function loginAction(
  formData: FormData,
): Promise<{ error: string } | void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/desk");

  const creds = getDeskCredentials();
  if (!creds.password) {
    return { error: "ATTENDANCE_PASSWORD is not configured on the server." };
  }

  if (username !== creds.username || password !== creds.password) {
    return { error: "Invalid username or password." };
  }

  const token = await createSessionToken({
    username,
    loggedInAt: Date.now(),
  });
  await setSessionCookie(token);
  redirect(next.startsWith("/") ? next : "/desk");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
