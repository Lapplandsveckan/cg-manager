import { useCallback, useMemo } from 'react';
import { noTry } from 'no-try';
import { useStoredString } from '../../lib/hooks/useStoredValue';

const STORAGE_KEY = 'commandPalette.recent';
const LIMIT = 5;

const parseIds = (raw: string | null): string[] => {
    const [, parsed] = noTry(() => JSON.parse(raw ?? '[]') as unknown);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
};

export function useRecentCommands() {
    const [raw, setRaw] = useStoredString(STORAGE_KEY);
    const recentIds = useMemo(() => parseIds(raw), [raw]);

    const remember = useCallback(
        (id: string) =>
            setRaw(prev => {
                const others = parseIds(prev).filter(known => known !== id);
                return JSON.stringify([id, ...others].slice(0, LIMIT));
            }),
        [setRaw],
    );

    return { recentIds, remember };
}
