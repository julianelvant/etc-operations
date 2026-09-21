import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createStaffAccount,
  deleteStaffAccount,
  listStaffAccounts,
  updateStaffAccount,
  type UpsertStaffInput,
} from "@/lib/auth/staff-accounts";
import type { SessionRole } from "@/lib/auth/session";

export async function GET() {
  try {
    await requireAdminSession();
    const accounts = await listStaffAccounts();
    return NextResponse.json({ accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminSession();
    const body = (await req.json()) as Partial<UpsertStaffInput>;
    const account = await createStaffAccount({
      username: String(body.username ?? ""),
      displayName: String(body.displayName ?? ""),
      role: (body.role === "admin" ? "admin" : "desk") as SessionRole,
      password: body.password,
      active: body.active,
      notes: body.notes,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminSession();
    const body = (await req.json()) as {
      id?: string;
      username?: string;
      displayName?: string;
      role?: SessionRole;
      password?: string;
      active?: boolean;
      notes?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const account = await updateStaffAccount(body.id, {
      username: body.username,
      displayName: body.displayName,
      role: body.role,
      password: body.password,
      active: body.active,
      notes: body.notes,
    });
    return NextResponse.json({ account });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdminSession();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteStaffAccount(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
