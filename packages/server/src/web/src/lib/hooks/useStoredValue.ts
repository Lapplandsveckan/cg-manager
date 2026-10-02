import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStorageItem, removeStorageItem, setStorageItem } from '../storage';

type Codec<T> = {
    read: (raw: string | null) => T | undefined;
    write: (value: T) => string | null;
    normalize?: (value: T) => T;
};

type Setter<T> = (next: T | ((prev: T) => T)) => void;

const booleanCodec: Codec<boolean> = {
    read: raw => (raw === '1' ? true : raw === '0' ? false : undefined),
    write: value => (value ? '1' : '0'),
};

const stringCodec: Codec<string | null> = {
    read: raw => raw ?? undefined,
    write: value => value,
};

const numberCodec = (clamp: (n: number) => number): Codec<number> => ({
    read: raw => (raw ? clamp(Number(raw)) : undefined),
    write: String,
    normalize: clamp,
});

const identity = (n: number) => n;

function persist(key: string, raw: string | null) {
    if (raw === null) return removeStorageItem(key);
    setStorageItem(key, raw);
}

export function useStoredValue<T>(
    key: string,
    fallback: T,
    codec: Codec<T>,
): [T, Setter<T>] {
    const [value, setValue] = useState(fallback);

    useEffect(() => {
        const stored = codec.read(getStorageItem(key));
        if (stored !== undefined) setValue(stored);
    }, [key, codec]);

    const update = useCallback<Setter<T>>(
        next => {
            setValue(prev => {
                const requested =
                    typeof next === 'function'
                        ? (next as (prev: T) => T)(prev)
                        : next;
                const resolved = codec.normalize?.(requested) ?? requested;
                persist(key, codec.write(resolved));
                return resolved;
            });
        },
        [key, codec],
    );

    return [value, update];
}

export const useStoredBoolean = (key: string, fallback: boolean) =>
    useStoredValue(key, fallback, booleanCodec);

export const useStoredString = (key: string, fallback: string | null = null) =>
    useStoredValue(key, fallback, stringCodec);

export function useStoredNumber(
    key: string,
    fallback: number,
    clamp: (n: number) => number = identity,
) {
    const codec = useMemo(() => numberCodec(clamp), [clamp]);
    return useStoredValue(key, fallback, codec);
}
