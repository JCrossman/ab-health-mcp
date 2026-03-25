/**
 * Date and value formatting utilities.
 *
 * The lab results API uses Date.toDateString() format in query params
 * (e.g., "Mon Jan 01 1753"). When accepting user dates as YYYY-MM-DD,
 * we convert with new Date(dateStr).toDateString().
 */

/**
 * Validate and convert YYYY-MM-DD to the API's expected date format.
 * Example: "2025-01-15" -> "Wed Jan 15 2025"
 * Throws if the date is not a valid YYYY-MM-DD string.
 */
export function toApiDateFormat(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: "${dateStr}".`);
  }
  return date.toDateString();
}

/**
 * URL-encode a date string for use in query parameters.
 */
export function encodeApiDate(dateStr: string): string {
  return encodeURIComponent(toApiDateFormat(dateStr));
}

/**
 * Default start date for "all" lab results queries.
 */
export const DEFAULT_START_DATE = 'Mon Jan 01 1753';

/**
 * Default end date for "all" lab results queries.
 */
export const DEFAULT_END_DATE = 'Fri Dec 31 9999';
