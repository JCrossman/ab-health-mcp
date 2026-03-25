import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHealthSession } from "@/lib/auth/health-session-store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const healthSession = getHealthSession(session.user.id);

  if (healthSession) {
    return NextResponse.json({
      connected: true,
      mhr: healthSession.mhrConnected,
      myChart: healthSession.myChartConnected,
      message: "Connected to Alberta health records",
      authenticatedAt: healthSession.authenticatedAt,
      userId: session.user.id,
    });
  }

  return NextResponse.json({
    connected: false,
    mhr: false,
    myChart: false,
    message: "Not connected",
    userId: session.user.id,
  });
}
