import { type CheckedRepClient } from './repClient';

export interface RundownItem {
    id: string;
    title: string;
    // Mirrors core's RundownItem.data — see the comment there. Narrowing
    // breaks every plugin action doing `item.data.x`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    /** Registered action type. Always set for stored items; optional so
     *  client-side drafts (editor pre-fill, drag payloads) share the shape. */
    type?: string;
    metadata?: { autoNext?: boolean; color?: string };
}

export interface Rundown {
    id: string;
    name: string;
    items: RundownItem[];
    type?: 'rundown' | 'quick';
    /** Read straight off the rundown's file on disk — not user-editable. */
    createdAt?: number;
}

export interface RundownActionDescriptor {
    id: string;
    hasStop: boolean;
    acceptsFiles?: boolean;
    fileTypes?: string[];
    destination?: string;
}

export class RundownsApi {
    private socket: CheckedRepClient;

    constructor(socket: CheckedRepClient) {
        this.socket = socket;
    }

    public async list(): Promise<Rundown[]> {
        const res = await this.socket.request('api/rundown', 'GET', {});
        return (res.data as Rundown[]) ?? [];
    }

    public async listQuick(): Promise<Rundown[]> {
        const res = await this.socket.request('api/rundown/quick', 'GET', {});
        return (res.data as Rundown[]) ?? [];
    }

    /** The server replies 200 with a null body for an unknown id — degrade to
     *  an empty rundown instead of surfacing that as missing query data. */
    public async get(id: string): Promise<Rundown> {
        const res = await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}`,
            'GET',
            {},
        );
        return (res.data as Rundown) ?? { id, name: '', items: [] };
    }

    public async create(name: string): Promise<Rundown> {
        const res = await this.socket.request('api/rundown', 'CREATE', name);
        return res.data as Rundown;
    }

    public async createQuick(name: string): Promise<Rundown> {
        const res = await this.socket.request(
            'api/rundown/quick',
            'CREATE',
            name,
        );
        return res.data as Rundown;
    }

    public async rename(id: string, name: string): Promise<Rundown> {
        const res = await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}`,
            'UPDATE',
            name,
        );
        return res.data as Rundown;
    }

    public async delete(id: string): Promise<void> {
        await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}`,
            'DELETE',
            null,
        );
    }

    public async createEntry(
        id: string,
        entry: RundownItem,
        index?: number,
    ): Promise<void> {
        await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}/entry`,
            'CREATE',
            typeof index === 'number' ? { entry, index } : entry,
        );
    }

    public async updateEntry(id: string, entry: RundownItem): Promise<void> {
        await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}/entry`,
            'UPDATE',
            entry,
        );
    }

    public async deleteEntry(id: string, entryId: string): Promise<void> {
        await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}/entry`,
            'DELETE',
            entryId,
        );
    }

    public async reorderEntries(id: string, order: string[]): Promise<void> {
        await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}/order`,
            'ACTION',
            order,
        );
    }

    public async getTypes(): Promise<string[]> {
        const res = await this.socket.request('api/rundown/types', 'GET', {});
        return (res.data as string[]) ?? [];
    }

    public async getActions(): Promise<RundownActionDescriptor[]> {
        const res = await this.socket.request('api/rundown/actions', 'GET', {});
        return (res.data as RundownActionDescriptor[]) ?? [];
    }

    public async matchActions<T = unknown>(file: {
        name: string;
        type: string;
        size: number;
    }): Promise<T[]> {
        const res = await this.socket.request(
            'api/rundown/actions/match',
            'ACTION',
            file,
        );
        return (res.data as T[]) ?? [];
    }

    public async matchMediaActions<T = unknown>(payload: {
        mediaId: string;
        name: string;
        type: string;
    }): Promise<T[]> {
        const res = await this.socket.request(
            'api/rundown/actions/match-media',
            'ACTION',
            payload,
        );
        return (res.data as T[]) ?? [];
    }

    public async stop(entry: RundownItem): Promise<void> {
        await this.socket.request('api/rundown/stop', 'ACTION', { entry });
    }

    public async execute(entry: RundownItem): Promise<void> {
        await this.socket.request('api/rundown/execute', 'ACTION', { entry });
    }
}
