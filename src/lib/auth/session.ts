import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "etc_desk_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type SessionRole = "desk" | "admin";

export type DeskSession = {
  username: string;
  role: SessionRole;
  loggedInAt: number;
  sessionId: string;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export function getDeskCredentials() {
  const username = process.env.ATTENDANCE_USERNAME ?? "desk";
  const password = process.env.ATTENDANCE_PASSWORD ?? "";
  return { username, password };
}

export function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  return { username, password };
}

/** Resolve username/password to a role, or null if invalid. */
export function resolveLoginRole(
  username: string,
  password: string,
): SessionRole | null {
  const desk = getDeskCredentials();
  const admin = getAdminCredentials();

  if (desk.password && username === desk.username && password === desk.password) {
    return "desk";
  }
  if (
    admin.username &&
    admin.password &&
    username === admin.username &&
    password === admin.password
  ) {
    return "admin";
  }
  return null;
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

export async function createSessionToken(session: DeskSession) {
  return new SignJWT({
    username: session.username,
    role: session.role,
    loggedInAt: session.loggedInAt,
    sessionId: session.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<DeskSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.username !== "string") return null;
    const role =
      payload.role === "admin" || payload.role === "desk"
        ? payload.role
        : "desk";
    const sessionId =
      typeof payload.sessionId === "string" && payload.sessionId
        ? payload.sessionId
        : "";
    return {
      username: payload.username,
      role,
      loggedInAt:
        typeof payload.loggedInAt === "number"
          ? payload.loggedInAt
          : Date.now(),
      sessionId,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<DeskSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireAdminSession(): Promise<DeskSession> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export { COOKIE_NAME, SESSION_TTL_SECONDS };
