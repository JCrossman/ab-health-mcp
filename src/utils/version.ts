export const OFFICIAL_DOWNLOAD_URL = 'https://www.myaihealth.ca/api/download-latest';

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function isValidVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.exec(value)?.[0] === value;
}

function comparePrerelease(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  // A release ranks above any prerelease of the same core version.
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  const left = a.split('.');
  const right = b.split('.');
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] === undefined) return -1;
    if (right[i] === undefined) return 1;
    const ln = /^\d+$/.test(left[i]) ? BigInt(left[i]) : undefined;
    const rn = /^\d+$/.test(right[i]) ? BigInt(right[i]) : undefined;
    if (ln !== undefined && rn !== undefined) {
      if (ln !== rn) return ln > rn ? 1 : -1;
    } else if (ln !== undefined) {
      return -1;
    } else if (rn !== undefined) {
      return 1;
    } else if (left[i] !== right[i]) {
      return left[i] > right[i] ? 1 : -1;
    }
  }
  return 0;
}

/** True only when `candidate` is a valid semantic version strictly newer than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const c = VERSION_PATTERN.exec(candidate);
  const i = VERSION_PATTERN.exec(current);
  if (!c || !i || c[0] !== candidate || i[0] !== current) return false;
  for (let j = 1; j <= 3; j++) {
    const left = BigInt(c[j]);
    const right = BigInt(i[j]);
    if (left !== right) return left > right;
  }
  return comparePrerelease(c[4], i[4]) > 0;
}

/**
 * Interpret an update-check response. Only a strictly newer version is offered, and
 * the user is always pointed at the fixed official download link, never a
 * server-supplied URL that is then presented to the model as an instruction.
 */
export function parseUpdateResponse(
  data: unknown,
  currentVersion: string,
): { latestVersion: string; downloadUrl: string } | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const { updateAvailable, latestVersion } = data as Record<string, unknown>;
  if (updateAvailable !== true || typeof latestVersion !== 'string') return undefined;
  if (!isNewerVersion(latestVersion, currentVersion)) return undefined;
  return { latestVersion, downloadUrl: OFFICIAL_DOWNLOAD_URL };
}
