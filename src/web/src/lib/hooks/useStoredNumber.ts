import {useEffect, useState} from 'react';
import {getStorageItem, setStorageItem} from '../storage';

const identity = (n: number) => n;

export function useStoredNumber(
    key: string,
    fallback: number,
    clamp: (n: number) => number = identity,
): [number, (next: number | ((prev: number) => number)) => void] {
    const [value, setValue] = useState(fallback);

    useEffect(() => {
        const raw = getStorageItem(key);
        if (raw) setValue(clamp(Number(raw)));
    }, [key, clamp]);

    const update = (next: number | ((prev: number) => number)) => {
        setValue(prev => {
            const val = clamp(typeof next === 'function' ? next(prev) : next);
            setStorageItem(key, String(val));
            return val;
        });
    };

    return [value, update];
}
