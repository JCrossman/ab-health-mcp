import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clearHealthSession } from "@/lib/auth/health-session-store";

/**
 * Disconnect from Alberta health records.
 * Clears stored health session cookies for this user.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearHealthSession(session.user.id);
  return NextResponse.json({ disconnected: true });
}
