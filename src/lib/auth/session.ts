import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "etc_desk_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type DeskSession = {
  username: string;
  loggedInAt: number;
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

export async function createSessionToken(session: DeskSession) {
  return new SignJWT({ username: session.username, loggedInAt: session.loggedInAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<DeskSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.username !== "string") return null;
    return {
      username: payload.username,
      loggedInAt: typeof payload.loggedInAt === "number" ? payload.loggedInAt : Date.now(),
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

export { COOKIE_NAME };
