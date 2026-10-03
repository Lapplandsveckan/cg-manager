import { noTry } from 'no-try';
import {
    compact,
    type CommandProvider,
    type CommandProviderOptions,
    type ListedCommand,
} from './types';

interface Registration {
    provider: CommandProvider;
    getOptions: () => CommandProviderOptions;
}

const DEFAULT_PRIORITY = 50;

export function createCommandRegistry() {
    const registrations = new Set<Registration>();
    const listeners = new Set<() => void>();
    const quickOpens: { id: string }[] = [];
    let version = 0;
    let active = false;

    const notify = () => {
        version += 1;
        listeners.forEach(listener => listener());
    };

    const register = (
        provider: CommandProvider,
        getOptions: () => CommandProviderOptions = () => ({}),
    ) => {
        const registration = { provider, getOptions };
        registrations.add(registration);
        if (active) notify();

        return () => {
            registrations.delete(registration);
            if (active) notify();
        };
    };

    const touch = () => {
        if (active) notify();
    };

    const setActive = (next: boolean) => {
        active = next;
        if (next) notify();
    };

    const setQuickOpen = (id: string) => {
        const entry = { id };
        quickOpens.push(entry);

        return () => {
            quickOpens.splice(quickOpens.indexOf(entry), 1);
        };
    };

    const getQuickOpen = (): string | undefined => quickOpens.at(-1)?.id;

    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    };

    const listFrom = ({ provider, getOptions }: Registration) => {
        const [, items] = noTry(provider);
        const options = getOptions();
        const priority = options.priority ?? DEFAULT_PRIORITY;

        return compact(items ?? []).map((command): ListedCommand => ({
            ...command,
            section: command.section ?? options.section,
            priority,
        }));
    };

    const collect = (): ListedCommand[] =>
        [...registrations]
            .map(listFrom)
            .flat()
            .sort((a, b) => b.priority - a.priority);

    return {
        register,
        touch,
        setActive,
        setQuickOpen,
        getQuickOpen,
        subscribe,
        collect,
        getVersion: () => version,
    };
}

export type CommandRegistry = ReturnType<typeof createCommandRegistry>;
