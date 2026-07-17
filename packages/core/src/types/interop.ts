export interface ServiceHandle<T = unknown> {
    /** Replace the registered implementation, e.g. after internal state changes shape. */
    update(impl: T): void;
    remove(): void;
}

export interface ContributionHandle<T = unknown> {
    update(value: T): void;
    remove(): void;
}

export interface Contribution<T = unknown> {
    owner: string;
    id: string;
    value: T;
}
