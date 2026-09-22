"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  createSessionToken,
  getSession,
  newSessionId,
  setSessionCookie,
} from "@/lib/auth/session";
import { authenticateStaff } from "@/lib/auth/staff-accounts";
import {
  recordSessionLogin,
  recordSessionLogout,
} from "@/lib/auth/desk-sessions";

export async function loginAction(
  formData: FormData,
): Promise<{ error: string } | void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "");

  let auth: Awaited<ReturnType<typeof authenticateStaff>> = null;
  try {
    auth = await authenticateStaff(username, password);
  } catch {
    return { error: "Sign-in failed. Please try again." };
  }
  if (!auth) {
    return { error: "Invalid username or password." };
  }

  const role = auth.role;
  const sessionId = newSessionId();
  const loggedInAt = Date.now();
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent");

  try {
    await recordSessionLogin({
      sessionId,
      username: auth.username,
      role,
      userAgent,
    });
  } catch {
    return { error: "Sign-in failed. Please try again." };
  }

  const token = await createSessionToken({
    username: auth.username,
    role,
    loggedInAt,
    sessionId,
  });
  await setSessionCookie(token);

  const defaultNext = role === "admin" ? "/admin" : "/desk";
  let next = nextRaw.startsWith("/") ? nextRaw : defaultNext;
  if (role === "desk" && next.startsWith("/admin")) next = "/desk";
  if (!nextRaw) next = defaultNext;

  redirect(next);
}

export async function logoutAction() {
  const session = await getSession();
  if (session?.sessionId) {
    try {
      await recordSessionLogout(session.sessionId);
    } catch {
      // still clear cookie
    }
  }
  await clearSessionCookie();
  redirect("/login");
}
