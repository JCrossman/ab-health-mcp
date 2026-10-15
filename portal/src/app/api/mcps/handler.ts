import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserMcps,
  enableMcp,
  disableMcp,
  addCustomMcp,
  CURATED_MCPS,
} from "@/lib/mcp/registry";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mcps = getUserMcps(session.user.id);
  return NextResponse.json({ mcps });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, serverId, apiKey, name, url } = await req.json();

  switch (action) {
    case "enable": {
      if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 });
      const curated = CURATED_MCPS.find((m) => m.id === serverId);
      if (!curated) return NextResponse.json({ error: "Unknown MCP" }, { status: 400 });
      enableMcp(session.user.id, serverId, apiKey);
      break;
    }
    case "disable": {
      if (!serverId) return NextResponse.json({ error: "Missing serverId" }, { status: 400 });
      if (serverId === "ab-health") {
        return NextResponse.json({ error: "Cannot disable Alberta Health Records" }, { status: 400 });
      }
      disableMcp(session.user.id, serverId);
      break;
    }
    case "add-custom": {
      if (!name || !url) {
        return NextResponse.json({ error: "Missing name or url" }, { status: 400 });
      }
      addCustomMcp(session.user.id, name, url, apiKey);
      break;
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true, mcps: getUserMcps(session.user.id) });
}
