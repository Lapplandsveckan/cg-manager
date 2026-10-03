export const modKey = (): string =>
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform)
        ? '⌘'
        : 'Ctrl';
