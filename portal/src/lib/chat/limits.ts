/**
 * All tunable guardrail thresholds for the chat feature.
 * Edit these values to tune cost and abuse controls without touching logic.
 */

/** Per-user maximum messages per day */
export const MAX_MESSAGES_PER_DAY = 50;

/** Max cumulative estimated input tokens in a single conversation */
export const MAX_TOKENS_PER_CONVERSATION = 30_000;

/** Max new conversations a user can start per day */
export const MAX_CONVERSATIONS_PER_DAY = 20;

/** Number of off-topic blocks per hour before abuse throttle activates */
export const ABUSE_OFF_TOPIC_THRESHOLD = 5;

/** Once throttled: one message allowed per this interval (ms) */
export const ABUSE_THROTTLE_WINDOW_MS = 5 * 60_000; // 5 minutes

/** Azure OpenAI gpt-4o pricing — USD per token (update when pricing changes) */
export const INPUT_COST_PER_TOKEN_USD = 2.5 / 1_000_000;
export const OUTPUT_COST_PER_TOKEN_USD = 10.0 / 1_000_000;

/** Per-user daily spend cap in USD */
export const PER_USER_DAILY_SPEND_CAP_USD = 2;

/** Global daily spend cap across all users (USD) */
export const DAILY_BETA_SPEND_CAP_USD = 10;

/** Global monthly spend cap — kill-switch if exceeded (USD) */
export const MONTHLY_BETA_SPEND_CAP_USD = 100;

/** Default max output tokens per request (used for worst-case cost pre-check) */
export const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
