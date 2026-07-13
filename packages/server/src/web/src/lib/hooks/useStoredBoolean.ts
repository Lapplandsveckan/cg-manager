import { useEffect, useState } from 'react';
import { getStorageItem, setStorageItem } from '../storage';

export function useStoredBoolean(
    key: string,
    fallback: boolean,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
    const [value, setValue] = useState(fallback);

    useEffect(() => {
        const raw = getStorageItem(key);
        if (raw === '1') setValue(true);
        else if (raw === '0') setValue(false);
    }, [key]);

    const update = (next: boolean | ((prev: boolean) => boolean)) => {
        setValue(prev => {
            const val = typeof next === 'function' ? next(prev) : next;
            setStorageItem(key, val ? '1' : '0');
            return val;
        });
    };

    return [value, update];
}
