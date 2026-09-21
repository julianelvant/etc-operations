"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  createSessionToken,
  getDeskCredentials,
  getSession,
  newSessionId,
  resolveLoginRole,
  setSessionCookie,
} from "@/lib/auth/session";
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

  const desk = getDeskCredentials();
  if (!desk.password) {
    return { error: "ATTENDANCE_PASSWORD is not configured on the server." };
  }

  const role = resolveLoginRole(username, password);
  if (!role) {
    return { error: "Invalid username or password." };
  }

  const sessionId = newSessionId();
  const loggedInAt = Date.now();
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent");

  try {
    await recordSessionLogin({
      sessionId,
      username,
      role,
      userAgent,
    });
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `Login audit failed: ${e.message}`
          : "Login audit failed",
    };
  }

  const token = await createSessionToken({
    username,
    role,
    loggedInAt,
    sessionId,
  });
  await setSessionCookie(token);

  const defaultNext = role === "admin" ? "/admin" : "/desk";
  let next = nextRaw.startsWith("/") ? nextRaw : defaultNext;
  // Desk users cannot land on admin
  if (role === "desk" && next.startsWith("/admin")) next = "/desk";
  // Prefer role home unless next is a sensible in-role path
  if (role === "admin" && (next === "/desk" || next.startsWith("/desk?"))) {
    // allow admin to open desk if they asked; otherwise default admin
    if (!nextRaw) next = "/admin";
  }
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
