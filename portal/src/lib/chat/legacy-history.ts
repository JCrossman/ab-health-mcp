/** Called only after an explicit user action. Values are never read or imported. */
export function removeLegacyHistory(storage: Pick<Storage, "length" | "key" | "removeItem">): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === "ab-health-conversations" || key?.startsWith("ab-health-msgs-")) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
