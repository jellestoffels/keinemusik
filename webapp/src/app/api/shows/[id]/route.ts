import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHOW_FIELD_MAP, type ShowEditableField } from "@/types/dto";

const STATUS_LABEL_TO_ENUM: Record<string, string> = {
  Option: "Option",
  Confirmed: "Confirmed",
  "To Do": "ToDo",
  Waiting: "Waiting",
  Done: "Done",
  Cancelled: "Cancelled",
};

const ARRAY_FIELDS = new Set<ShowEditableField>(["artists", "ld", "lo", "pm", "se"]);

/** Generic single-field update, mirrors the legacy Apps Script `updateShowData()`. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const field = body?.field as ShowEditableField | undefined;
  const value = body?.value;

  if (!field || !(field in SHOW_FIELD_MAP)) {
    return NextResponse.json({ error: `Unsupported field "${field}"` }, { status: 400 });
  }

  const column = SHOW_FIELD_MAP[field];
  let data: Record<string, unknown>;

  if (field === "status") {
    const enumValue = STATUS_LABEL_TO_ENUM[String(value)];
    if (!enumValue) return NextResponse.json({ error: `Unknown status "${value}"` }, { status: 400 });
    data = { [column]: enumValue };
  } else if (field === "capacity") {
    const n = value === "" || value === null ? null : parseInt(String(value), 10);
    data = { [column]: Number.isFinite(n) ? n : null };
  } else if (ARRAY_FIELDS.has(field)) {
    data = { [column]: Array.isArray(value) ? value : String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean) };
  } else {
    data = { [column]: value };
  }

  try {
    await prisma.show.update({ where: { id }, data });
  } catch {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
