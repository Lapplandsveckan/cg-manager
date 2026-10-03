import type { ReactNode } from 'react';

export interface CommandBase {
    id: string;
    label: string;
    description?: string;
    section?: string;
    keywords?: string[];
    icon?: ReactNode;
    disabled?: boolean | string;
    danger?: boolean;
    shortcut?: string;
}

export interface RunCommand extends CommandBase {
    run: () => unknown;
}

export interface ParentCommand extends CommandBase {
    placeholder?: string;
    children: () => CommandItem[] | Promise<CommandItem[]>;
}

export interface PromptCommand extends CommandBase {
    prompt: {
        placeholder: string;
        initial?: string;
        validate?: (value: string) => string | null;
        submitLabel?: (value: string) => string;
        submit: (value: string) => unknown;
    };
}

export type Command = RunCommand | ParentCommand | PromptCommand;
export type CommandItem = Command | false | null | undefined;
export type CommandProvider = () => CommandItem[];

export interface CommandProviderOptions {
    section?: string;
    priority?: number;
}

export type ListedCommand = Command & { priority: number };

export type NestedCommand = ParentCommand | PromptCommand;

export const isParent = (command: Command): command is ParentCommand =>
    'children' in command;

export const isPrompt = (command: Command): command is PromptCommand =>
    'prompt' in command;

export const isDisabled = (command: Command): boolean =>
    Boolean(command.disabled);

export const compact = (items: CommandItem[]): Command[] =>
    items.filter((item): item is Command => Boolean(item));
