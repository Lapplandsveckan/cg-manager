export type CompanionOption =
    | { type: 'dropdown'; id: string; label: string; choices: { id: string; label: string }[]; default?: string }
    | { type: 'textinput'; id: string; label: string; default?: string }
    | { type: 'number'; id: string; label: string; default?: number; min?: number; max?: number }
    | { type: 'checkbox'; id: string; label: string; default?: boolean }
    | { type: 'colorpicker'; id: string; label: string; default?: number };

export interface CompanionStyle {
    text?: string;
    size?: number | 'auto';
    color?: number;
    bgcolor?: number;
    /** Base64 PNG data URI or raw base64 — rendered as a button thumbnail by Companion. */
    png64?: string;
}

export type OptionValues = Record<string, string | number | boolean>;
export interface InvokeContext { surface?: string }

export interface ActionDefinition {
    id: string;
    name: string;
    description?: string;
    options?: CompanionOption[];
    handler: (options: OptionValues, ctx: InvokeContext) => void | Promise<void>;
}

export interface FeedbackDefinition {
    id: string;
    name: string;
    description?: string;
    type: 'boolean' | 'advanced';
    options?: CompanionOption[];
    /** For boolean feedbacks: style applied while the value is true. */
    defaultStyle?: CompanionStyle;
    /** Runs server-side. Return a boolean (boolean feedbacks) or a style object (advanced). */
    evaluate: (options: OptionValues) => boolean | CompanionStyle;
}

export interface ActionHandle {
    readonly id: string;
    /** Merge a partial update into the definition and broadcast the new definition. */
    update(patch: Partial<Omit<ActionDefinition, 'id'>>): void;
    remove(): void;
}

export interface FeedbackHandle {
    readonly id: string;
    /** Merge a partial update into the definition and broadcast the new definition. */
    update(patch: Partial<Omit<FeedbackDefinition, 'id'>>): void;
    /**
     * Re-evaluate all subscribed instances of this feedback and push changed
     * values to Companion. Call whenever internal plugin state changes.
     */
    invalidate(): void;
    remove(): void;
}
