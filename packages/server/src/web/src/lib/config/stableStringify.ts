export function stableStringify(value: unknown): string {
    return JSON.stringify(value, (_key, val) =>
        val && typeof val === 'object' && !Array.isArray(val)
            ? Object.fromEntries(
                  Object.entries(val).sort(([a], [b]) => a.localeCompare(b)),
              )
            : val,
    );
}
