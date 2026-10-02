import { type REPClient } from 'rest-exchange-protocol-client';
import type {
    Rundown as ServerRundown,
    RundownItemDraft,
} from '../../../../schemas/rundown.types';

export type RundownItem = RundownItemDraft;

export type Rundown = Omit<ServerRundown, 'items'> & {
    items: RundownItem[];
};

export interface RundownActionDescriptor {
    id: string;
    hasStop: boolean;
    acceptsFiles?: boolean;
    fileTypes?: string[];
    destination?: string;
}

export class RundownsApi {
    private socket: REPClient;

    constructor(socket: REPClient) {
        this.socket = socket;
    }

    public async list(): Promise<Rundown[]> {
        const res = await this.socket.request('api/rundown', 'GET', {});
        return (res as Rundown[]) ?? [];
    }

    public async listQuick(): Promise<Rundown[]> {
        const res = await this.socket.request('api/rundown/quick', 'GET', {});
        return (res as Rundown[]) ?? [];
    }

    /** The server replies 200 with a null body for an unknown id — degrade to
     *  an empty rundown instead of surfacing that as missing query data. */
    public async get(id: string): Promise<Rundown> {
        const res = await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}`,
            'GET',
            {},
        );
        return (res as Rundown) ?? { id, name: '', items: [] };
    }

    public async create(name: string): Promise<Rundown> {
        const res = await this.socket.request('api/rundown', 'CREATE', name);
        return res as Rundown;
    }

    public async createQuick(name: string): Promise<Rundown> {
        const res = await this.socket.request(
            'api/rundown/quick',
            'CREATE',
            name,
        );
        return res as Rundown;
    }

    public async rename(id: string, name: string): Promise<Rundown> {
        const res = await this.socket.request(
            `api/rundown/${encodeURIComponent(id)}`,
            'UPDATE',
            name,
        );
        return res as Rundown;
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
        return (res as string[]) ?? [];
    }

    public async getActions(): Promise<RundownActionDescriptor[]> {
        const res = await this.socket.request('api/rundown/actions', 'GET', {});
        return (res as RundownActionDescriptor[]) ?? [];
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
        return (res as T[]) ?? [];
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
        return (res as T[]) ?? [];
    }

    public async stop(entry: RundownItem): Promise<void> {
        await this.socket.request('api/rundown/stop', 'ACTION', { entry });
    }

    public async execute(entry: RundownItem): Promise<void> {
        await this.socket.request('api/rundown/execute', 'ACTION', { entry });
    }
}
