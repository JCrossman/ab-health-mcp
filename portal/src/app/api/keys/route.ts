import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  setApiKey,
  removeApiKey,
  listUserProviders,
  SUPPORTED_PROVIDERS,
} from "@/lib/ai/providers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = listUserProviders(session.user.id);
  const providers = SUPPORTED_PROVIDERS.map((p) => {
    const userConfig = configured.find((c) => c.providerId === p.id);
    return {
      ...p,
      configured: !!userConfig?.hasKey,
      baseUrl: userConfig?.baseUrl,
    };
  });

  return NextResponse.json({ providers });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { providerId, apiKey, baseUrl } = await req.json();

  if (!providerId || typeof providerId !== "string") {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }

  const provider = SUPPORTED_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  if (provider.id !== "ollama" && (!apiKey || typeof apiKey !== "string")) {
    return NextResponse.json({ error: "Missing apiKey" }, { status: 400 });
  }

  setApiKey(session.user.id, providerId, apiKey || "", baseUrl);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { providerId } = await req.json();
  if (!providerId) {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }

  removeApiKey(session.user.id, providerId);
  return NextResponse.json({ success: true });
}
