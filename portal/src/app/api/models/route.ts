import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvailableModels } from "@/lib/ai/model-resolver";

const MODEL_MODE = process.env.PORTAL_MODEL_MODE ?? "beta-azure-ca";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const betaMode = MODEL_MODE === "beta-azure-ca";
  const models = getAvailableModels(session.user.id);

  if (betaMode) {
    // In beta mode, the single Azure OpenAI CA East model is the only option.
    // Mark it as default and set canadianHosted for the UI.
    return NextResponse.json({
      betaMode: true,
      models: models.map((m) => ({ ...m, isDefault: true })),
    });
  }

  // Multi mode: include the server-default OpenAI model plus user BYOK models
  const defaultModel = {
    providerId: "openai",
    providerName: "OpenAI (Default)",
    modelId: "gpt-4o",
    canadianHosted: false,
    isDefault: true,
  };

  return NextResponse.json({
    betaMode: false,
    models: [defaultModel, ...models.filter((m) => m.modelId !== "gpt-4o" || m.providerId !== "openai")],
  });
}
