import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildAttendanceWorkbook } from "@/lib/export-workbook";
import { getBeirutParts } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const today = getBeirutParts().date;
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "from and to must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: "from must be on or before to" },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildAttendanceWorkbook(from, to);
    const filename = `etc-attendance_${from}_to_${to}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    );
  }
}
