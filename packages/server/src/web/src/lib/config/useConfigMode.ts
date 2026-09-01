import { useEffect, useState } from 'react';
import { getStorageItem, setStorageItem } from '../storage';

export type ConfigMode = 'simple' | 'advanced';

export const CONFIG_MODE_STORAGE_KEY = 'configMode';

const isConfigMode = (value: string | null): value is ConfigMode =>
    value === 'simple' || value === 'advanced';

export function useConfigMode() {
    // Deterministic default so SSR and the first hydration frame agree; a
    // mount effect below corrects it from localStorage once on the client.
    const [mode, setModeState] = useState<ConfigMode>('simple');

    useEffect(() => {
        const stored = getStorageItem(CONFIG_MODE_STORAGE_KEY);
        if (isConfigMode(stored)) setModeState(stored);
    }, []);

    // Writes storage here, not in an effect keyed on `mode` — an effect
    // would let the SSR default overwrite a stored preference for one frame
    // before the mount-read effect above corrects it.
    const setMode = (next: ConfigMode) => {
        setModeState(next);
        setStorageItem(CONFIG_MODE_STORAGE_KEY, next);
    };

    return { mode, setMode };
}
