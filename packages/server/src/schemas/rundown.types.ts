export interface RundownItem {
    id: string;
    title: string;
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    metadata: {
        autoNext: boolean;
        color?: string;
    };
}

export interface Rundown {
    id: string;
    name: string;
    items: RundownItem[];
    type?: 'rundown' | 'quick';
    createdAt?: number;
}

export type RundownItemDraft = Omit<RundownItem, 'type' | 'metadata'> & {
    type?: string;
    metadata?: Partial<RundownItem['metadata']>;
};
