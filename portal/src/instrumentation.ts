/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Initializes the App Insights Node SDK for server-side telemetry.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in the Node.js runtime (not edge or browser)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled"
      );
    }
    return;
  }

  try {
    const { TelemetryClient } = await import("applicationinsights");
    const { setTelemetryClient } = await import("@/lib/telemetry/events");

    const client = new TelemetryClient(connectionString);
    setTelemetryClient(client);
  } catch (err) {
    console.error("[telemetry] Failed to initialize App Insights:", err);
  }
}
