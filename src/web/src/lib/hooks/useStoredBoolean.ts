import {useEffect, useState} from 'react';
import {noTry} from 'no-try';

/**
 * Boolean state mirrored to localStorage under the given key. Initial render
 * uses `fallback`; once mounted in the browser we read the saved value and
 * update if different. Subsequent updates write through to storage.
 *
 * SSR-safe: the read is gated on `typeof window` so Next's server render
 * sees the fallback and the hydration tick picks up the real value.
 */
export function useStoredBoolean(key: string, fallback: boolean): [boolean, (b: boolean) => void] {
    const [value, setValue] = useState(fallback);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const [, raw] = noTry(() => window.localStorage.getItem(key));
        if (raw === '1') setValue(true);
        else if (raw === '0') setValue(false);
    }, [key]);

    const update = (next: boolean) => {
        setValue(next);
        noTry(() => window.localStorage.setItem(key, next ? '1' : '0'));
    };

    return [value, update];
}
