import { noTry } from 'no-try';

export function getStorageItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    const [, val] = noTry(() => window.localStorage.getItem(key));
    return val ?? null;
}

export function setStorageItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    noTry(() => window.localStorage.setItem(key, value));
}

export function removeStorageItem(key: string): void {
    if (typeof window === 'undefined') return;
    noTry(() => window.localStorage.removeItem(key));
}
