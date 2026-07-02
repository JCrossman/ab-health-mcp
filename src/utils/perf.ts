/**
 * Tool-handler timing wrapper.
 *
 * Opt-in via AB_HEALTH_PERF_LOG=1. When enabled, every wrapped handler emits
 * one line of JSON to stderr after it resolves or rejects:
 *
 *   {"perf":true,"tool":"get_lab_results","demo":true,"duration_ms":42.31,
 *    "response_bytes":3187,"is_error":false}
 *
 * The line is intentionally a single, machine-parsable JSON object so the
 * bench harness can grep it out of the stderr stream without affecting
 * normal logger output.
 *
 * PII/PHI safety: only tool name, demo flag, duration, byte count, and the
 * error flag are emitted. Never logs args, response content, or any patient
 * data.
 *
 * The wrapper is fully type-passthrough — it preserves the exact callable
 * signature of the handler so MCP SDK type-checks of server.tool() registrations
 * remain intact.
 */

import { performance } from 'node:perf_hooks';
import { isDemoMode } from '../helpers/demo/index.js';

const PERF_LOG_ENABLED = process.env.AB_HEALTH_PERF_LOG === '1';

export function withPerfTiming<H extends (...args: never[]) => unknown>(
  toolName: string,
  handler: H,
): H {
  if (!PERF_LOG_ENABLED) return handler;

  const wrapped = async (...args: Parameters<H>): Promise<Awaited<ReturnType<H>>> => {
    const start = performance.now();
    let isError = false;
    let responseBytes = 0;
    try {
      const result = (await (handler as (...a: Parameters<H>) => unknown)(...args)) as Awaited<ReturnType<H>>;
      if (result && typeof result === 'object') {
        const r = result as { content?: unknown; isError?: unknown };
        if (Array.isArray(r.content)) {
          for (const c of r.content) {
            if (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string') {
              responseBytes += Buffer.byteLength((c as { text: string }).text, 'utf8');
            }
          }
        }
        isError = Boolean(r.isError);
      }
      return result;
    } catch (err) {
      isError = true;
      throw err;
    } finally {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const line = JSON.stringify({
        perf: true,
        tool: toolName,
        demo: isDemoMode(),
        duration_ms: durationMs,
        response_bytes: responseBytes,
        is_error: isError,
      });
      process.stderr.write(line + '\n');
    }
  };

  return wrapped as unknown as H;
}

