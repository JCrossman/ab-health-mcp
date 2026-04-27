/**
 * Lightweight pre-LLM classifier for obviously off-topic messages.
 *
 * Conservative by design — better to let ambiguous messages through to the LLM
 * (which also refuses via system prompt) than to wrongly block a legitimate health question.
 */

export interface ScopeFilterResult {
  offTopic: boolean;
  /** Classifier category — never contains user message content. */
  reason?: string;
}

/** Canned redirect shown to users when the classifier short-circuits the request. */
export const OFF_TOPIC_REDIRECT =
  "I can only help with your Alberta health records. Try asking about your labs, medications, vitals, immunizations, or appointments.";

const OFF_TOPIC_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Creative writing
  {
    pattern:
      /\b(write|compose|create|give me)\s+(me\s+)?(a\s+)?(poem|sonnet|haiku|rhyme|limerick|song|lyrics?)\b/i,
    reason: "creative-writing-poetry",
  },
  {
    pattern:
      /\b(write|help me write|draft|create)\s+(a\s+)?(short story|essay|blog post|article|novel|screenplay)\b/i,
    reason: "creative-writing-text",
  },
  // Coding requests
  {
    pattern:
      /\b(write|generate|create|produce|show me)\s+(some\s+)?(code|a program|a function|a script|a class|an app)\b/i,
    reason: "coding-request",
  },
  {
    pattern: /\bcan you (code|program|debug|fix my code|write code|build)\b/i,
    reason: "coding-request",
  },
  // Roleplay / persona injection
  {
    pattern:
      /\b(pretend (you are|to be)|act as|roleplay as|you are now|imagine you are|play the role of)\b/i,
    reason: "roleplay-persona",
  },
  // Jailbreak attempts
  {
    pattern:
      /\b(ignore (previous|all|your) instructions?|disregard (your|the|all) (instructions?|rules?)|forget (your|all|previous) (instructions?|rules?))\b/i,
    reason: "jailbreak-attempt",
  },
  {
    pattern: /\bDAN\b|\bjailbreak\b|\bdo anything now\b/i,
    reason: "jailbreak-attempt",
  },
  // Entertainment / trivia
  {
    pattern: /\b(tell me|know|share)\s+(a\s+)?(joke|funny story|riddle|pun)\b/i,
    reason: "entertainment-humor",
  },
  // Weather
  {
    pattern: /\bwhat('?s| is) the weather\b/i,
    reason: "weather-query",
  },
  // Cooking
  {
    pattern: /\b(recipe for|how (to cook|do I cook|do I make|to make) .{3,40})\b/i,
    reason: "cooking-recipe",
  },
  // Finance / markets
  {
    pattern: /\b(stock price|crypto price|bitcoin price|exchange rate|nfl score|nba score)\b/i,
    reason: "financial-or-sports-query",
  },
  // Sports scores
  {
    pattern: /\bwho (won|is winning) the\b/i,
    reason: "sports-query",
  },
  // Generic translation
  {
    pattern: /\btranslate (this|the following|these words?) (to|into) [a-z]{3,}\b/i,
    reason: "translation-request",
  },
  // Math homework
  {
    pattern:
      /\b(solve (this|the) (math|algebra|calculus|equation)|calculate \d+ [+\-*\/] \d+)\b/i,
    reason: "math-homework",
  },
];

/**
 * Returns { offTopic: true, reason } if the message clearly matches an off-topic pattern,
 * otherwise { offTopic: false }.
 */
export function isObviouslyOffTopic(text: string): ScopeFilterResult {
  if (!text || text.trim().length === 0) return { offTopic: false };

  for (const { pattern, reason } of OFF_TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      return { offTopic: true, reason };
    }
  }

  return { offTopic: false };
}
