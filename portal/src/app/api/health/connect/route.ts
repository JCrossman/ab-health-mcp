import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  authenticateWithBrowser,
  serializeSession,
} from "@/lib/auth/health-auth";
import { setHealthSession } from "@/lib/auth/health-session-store";

/**
 * Connect to Alberta health records.
 *
 * Launches a visible Chrome window where the user logs in manually
 * on Alberta's actual SSO page. No credentials are passed through
 * our server — zero bot detection risk.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await authenticateWithBrowser();
    const sessionData = serializeSession(result);
    setHealthSession(session.user.id, sessionData);

    return NextResponse.json({
      connected: true,
      mhr: result.mhrConnected,
      myChart: result.myChartConnected,
      message: result.mhrConnected
        ? "Successfully connected to Alberta health records."
        : "Sign-in worked, but we couldn't connect to My Health Records. Please try again.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed";

    if (message.includes("rate-limiting")) {
      return NextResponse.json(
        {
          connected: false,
          error: "rate_limited",
          message:
            "Alberta's sign-in service is temporarily busy. Please wait 5–10 minutes and try again.",
        },
        { status: 429 }
      );
    }

    if (message.includes("timed out") || message.toLowerCase().includes("timeout")) {
      return NextResponse.json(
        {
          connected: false,
          error: "timeout",
          message:
            "Login timed out. Please complete sign-in within 3 minutes.",
        },
        { status: 504 }
      );
    }

    console.error("[Health Connect] Auth failed:", message);

    return NextResponse.json(
      {
        connected: false,
        error: "auth_failed",
        message: "Sign-in failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

