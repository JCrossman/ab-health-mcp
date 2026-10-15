/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Initializes the App Insights Node SDK for server-side telemetry.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in the Node.js runtime (not edge or browser)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { isTelemetryEnabled } = await import("@/lib/telemetry/events");
  if (!isTelemetryEnabled()) return;

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

    const client = new TelemetryClient(connectionString, { useGlobalProviders: false });
    // Only our allowlisted custom events: no request URLs, cookies, exceptions or disk spool.
    Object.assign(client.config, {
      enableAutoCollectRequests: false,
      enableAutoCollectDependencies: false,
      enableAutoCollectExceptions: false,
      enableAutoCollectConsole: false,
      enableAutoCollectExternalLoggers: false,
      enableAutoCollectPerformance: false,
      enableAutoCollectPreAggregatedMetrics: false,
      enableAutoCollectHeartbeat: false,
      enableAutoCollectExtendedMetrics: false,
      enableAutoCollectIncomingRequestAzureFunctions: false,
      enableSendLiveMetrics: false,
      enableWebInstrumentation: false,
      enableUseDiskRetryCaching: false,
      enableInternalDebugLogging: false,
      enableInternalWarningLogging: false,
    });
    setTelemetryClient(client);
  } catch {
    console.error("[telemetry] Failed to initialize App Insights");
  }
}
