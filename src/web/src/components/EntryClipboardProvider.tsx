import React, { createContext, useContext, useRef, useState } from 'react';
import type { RundownEntry } from './Rundowns';

interface EntryClipboard {
    copy: (entry: RundownEntry) => void;
    paste: () => RundownEntry | null;
    hasEntry: boolean;
}

const EntryClipboardContext = createContext<EntryClipboard>({
    copy: () => undefined,
    paste: () => null,
    hasEntry: false,
});

export const useEntryClipboard = (): EntryClipboard =>
    useContext(EntryClipboardContext);

export const EntryClipboardProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const ref = useRef<RundownEntry | null>(null);
    const [hasEntry, setHasEntry] = useState(false);

    const copy = (entry: RundownEntry) => {
        ref.current = entry;
        setHasEntry(true);
    };

    const paste = () => ref.current;

    return (
        <EntryClipboardContext.Provider value={{ copy, paste, hasEntry }}>
            {children}
        </EntryClipboardContext.Provider>
    );
};
