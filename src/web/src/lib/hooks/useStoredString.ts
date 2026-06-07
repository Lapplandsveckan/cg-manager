import {useEffect, useState} from 'react';
import {getStorageItem, removeStorageItem, setStorageItem} from '../storage';

export function useStoredString(
    key: string,
    fallback: string | null = null,
): [string | null, (next: string | null | ((prev: string | null) => string | null)) => void] {
    const [value, setValue] = useState(fallback);

    useEffect(() => {
        const raw = getStorageItem(key);
        if (raw !== null) setValue(raw);
    }, [key]);

    const update = (next: string | null | ((prev: string | null) => string | null)) => {
        setValue(prev => {
            const val = typeof next === 'function' ? next(prev) : next;
            if (val === null) removeStorageItem(key);
            else setStorageItem(key, val);
            return val;
        });
    };

    return [value, update];
}
