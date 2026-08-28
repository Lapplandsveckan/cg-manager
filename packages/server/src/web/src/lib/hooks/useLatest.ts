import { useEffect, useRef } from 'react';

/** Ref that always holds the most recent render's value. Written from an
 *  effect rather than during render, so render stays side-effect free and
 *  concurrent re-renders can't leave a half-applied value behind. Read it
 *  from async callbacks that would otherwise close over a stale value. */
export function useLatest<T>(value: T) {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    });
    return ref;
}
