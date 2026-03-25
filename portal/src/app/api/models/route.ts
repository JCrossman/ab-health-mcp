import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvailableModels } from "@/lib/ai/model-resolver";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const models = getAvailableModels(session.user.id);

  // Always include the default server model
  const defaultModel = {
    providerId: "openai",
    providerName: "OpenAI (Default)",
    modelId: "gpt-4o",
    canadianHosted: false,
    isDefault: true,
  };

  return NextResponse.json({
    models: [defaultModel, ...models.filter((m) => m.modelId !== "gpt-4o" || m.providerId !== "openai")],
  });
}
