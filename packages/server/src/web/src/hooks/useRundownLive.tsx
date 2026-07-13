import { createContext, useContext, type ReactNode } from 'react';

const RundownLiveContext = createContext(false);

export function RundownLiveProvider({
    live,
    children,
}: {
    live: boolean;
    children: ReactNode;
}) {
    return (
        <RundownLiveContext.Provider value={live}>
            {children}
        </RundownLiveContext.Provider>
    );
}

/** Returns `true` when the nearest rundown ancestor is in live mode, `false` in edit mode or outside a rundown. */
export function useRundownLive(): boolean {
    return useContext(RundownLiveContext);
}
