import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import { useToast } from '../ToastProvider';
import { SlotErrorBoundary } from '../SlotErrorBoundary';
import { CommandPalette } from './CommandPalette';
import { createCommandRegistry, type CommandRegistry } from './registry';
import type { CommandProvider, CommandProviderOptions } from './types';

interface PaletteState {
    isOpen: boolean;
    open: (commandId?: string) => void;
    close: () => void;
}

const noopRegistry = createCommandRegistry();

const RegistryContext = createContext<CommandRegistry>(noopRegistry);

const PaletteContext = createContext<PaletteState>({
    isOpen: false,
    open: () => undefined,
    close: () => undefined,
});

export const useCommandPalette = (): PaletteState => useContext(PaletteContext);

export const useRegisterCommands = (
    provider: CommandProvider,
    options?: CommandProviderOptions,
): void => {
    const registry = useContext(RegistryContext);
    const ref = useRef(provider);
    ref.current = provider;
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(
        () =>
            registry.register(
                () => ref.current(),
                () => optionsRef.current ?? {},
            ),
        [registry],
    );

    useEffect(() => registry.touch());
};

export const useQuickOpenCommand = (commandId: string): void => {
    const registry = useContext(RegistryContext);
    useEffect(() => registry.setQuickOpen(commandId), [registry, commandId]);
};

const isShortcut = (event: KeyboardEvent, shift: boolean): boolean =>
    (event.metaKey || event.ctrlKey) &&
    event.shiftKey === shift &&
    !event.altKey &&
    (event.key.toLowerCase() === 'k' || event.code === 'KeyK');

export const CommandPaletteProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const { t } = useTranslation('common');
    const notify = useToast();
    const registry = useMemo(() => createCommandRegistry(), []);
    const [isOpen, setOpen] = useState(false);
    const [entry, setEntry] = useState<string | null>(null);

    const open = useCallback((commandId?: string) => {
        setEntry(typeof commandId === 'string' ? commandId : null);
        setOpen(true);
    }, []);
    const close = useCallback(() => setOpen(false), []);

    useEffect(() => registry.setActive(isOpen), [registry, isOpen]);

    const isOpenRef = useRef(isOpen);
    isOpenRef.current = isOpen;

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) return;

            const quick = isShortcut(event, true);
            if (!quick && !isShortcut(event, false)) return;

            event.preventDefault();
            if (isOpenRef.current) return setOpen(false);
            open(quick ? registry.getQuickOpen() : undefined);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [registry, open]);

    const run = useCallback(
        async (action: () => unknown) => {
            setOpen(false);
            const [error] = await noTryAsync(async () => action());
            if (!error) return;
            notify(
                (error as Error).message || t('commandPalette.failed'),
                'error',
            );
        },
        [notify, t],
    );

    const state = useMemo(
        () => ({ isOpen, open, close }),
        [isOpen, open, close],
    );

    return (
        <RegistryContext.Provider value={registry}>
            <PaletteContext.Provider value={state}>
                {children}
                <SlotErrorBoundary label="command-palette" silent>
                    <CommandPalette
                        registry={registry}
                        open={isOpen}
                        entry={entry}
                        onClose={close}
                        onRun={run}
                    />
                </SlotErrorBoundary>
            </PaletteContext.Provider>
        </RegistryContext.Provider>
    );
};
