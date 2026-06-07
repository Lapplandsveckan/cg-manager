import { noTry } from 'no-try';

export const SUPPORTED_LANGUAGES = ['en', 'sv'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'language';

/**
 * Detect the preferred language. Resolution order:
 *   1. Saved preference in localStorage (written by the language selector).
 *   2. Browser language (navigator.language) mapped to a supported locale.
 *   3. Fallback: 'en'.
 *
 * SSR-safe: returns 'en' when window is not defined so the server render
 * and the first hydration frame agree before the mount effect corrects it.
 */
export function detectLanguage(): SupportedLanguage {
    if (typeof window === 'undefined') return 'en';

    const [, stored] = noTry(() =>
        window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored))
        return stored as SupportedLanguage;

    const [, nav] = noTry(() => navigator.language ?? '');
    if (nav?.startsWith('sv')) return 'sv';

    return 'en';
}

export function setStoredLanguage(lng: SupportedLanguage): void {
    noTry(() => window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng));
}
