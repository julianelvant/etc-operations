export type SessionRole = "desk" | "admin";

export function roleLabel(role: SessionRole): string {
  return role === "admin" ? "Admin" : "Administrative assistant";
}
