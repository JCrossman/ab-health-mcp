const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

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
    const ln = /^\d+$/.test(left[i]) ? Number(left[i]) : undefined;
    const rn = /^\d+$/.test(right[i]) ? Number(right[i]) : undefined;
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
  if (!c || !i) return false;
  for (let j = 1; j <= 3; j++) {
    const diff = Number(c[j]) - Number(i[j]);
    if (diff !== 0) return diff > 0;
  }
  return comparePrerelease(c[4], i[4]) > 0;
}
