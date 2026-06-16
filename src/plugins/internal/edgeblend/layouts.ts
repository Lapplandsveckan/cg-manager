import fs from 'fs/promises';
import path from 'path';
import { noTry, noTryAsync } from 'no-try';
import { UUID } from '../../../util/uuid';

export interface StoredLayout {
    id: string;
    name: string;
    enabled: boolean;
    canvasSize: [number, number];
    projectorSize: [number, number];
    size: [number, number]; // [cols, rows]
    inputChannel: number;
    outputChannels: number[];
}

export type LayoutInput = Omit<StoredLayout, 'id'>;
export type LayoutPatch = Partial<LayoutInput>;

const isTuple2 = (v: unknown): v is [number, number] =>
    Array.isArray(v) &&
    v.length === 2 &&
    v.every(n => typeof n === 'number' && n > 0);

const isChannelArr = (v: unknown): v is number[] =>
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(n => typeof n === 'number' && n >= 1);

const isValidInput = (r: Record<string, unknown>): boolean =>
    typeof r['name'] === 'string' &&
    typeof r['enabled'] === 'boolean' &&
    isTuple2(r['canvasSize']) &&
    isTuple2(r['projectorSize']) &&
    isTuple2(r['size']) &&
    typeof r['inputChannel'] === 'number' &&
    (r['inputChannel'] as number) >= 1 &&
    isChannelArr(r['outputChannels']);

export const validateInput = (data: unknown): LayoutInput | null => {
    if (typeof data !== 'object' || !data) return null;
    const r = data as Record<string, unknown>;
    if (!isValidInput(r)) return null;
    return {
        name: r['name'] as string,
        enabled: r['enabled'] as boolean,
        canvasSize: r['canvasSize'] as [number, number],
        projectorSize: r['projectorSize'] as [number, number],
        size: r['size'] as [number, number],
        inputChannel: r['inputChannel'] as number,
        outputChannels: r['outputChannels'] as number[],
    };
};

/** Validates only the fields that are present — used by the PATCH route. */
export const validatePatch = (data: unknown): LayoutPatch | null => {
    if (typeof data !== 'object' || !data) return {};
    const r = data as Record<string, unknown>;
    const patch: LayoutPatch = {};

    if ('name' in r) {
        if (typeof r['name'] !== 'string') return null;
        patch.name = r['name'];
    }
    if ('enabled' in r) {
        if (typeof r['enabled'] !== 'boolean') return null;
        patch.enabled = r['enabled'];
    }
    if ('canvasSize' in r) {
        if (!isTuple2(r['canvasSize'])) return null;
        patch.canvasSize = r['canvasSize'];
    }
    if ('projectorSize' in r) {
        if (!isTuple2(r['projectorSize'])) return null;
        patch.projectorSize = r['projectorSize'];
    }
    if ('size' in r) {
        if (!isTuple2(r['size'])) return null;
        patch.size = r['size'];
    }
    if ('inputChannel' in r) {
        if (typeof r['inputChannel'] !== 'number' || r['inputChannel'] < 1)
            return null;
        patch.inputChannel = r['inputChannel'];
    }
    if ('outputChannels' in r) {
        if (!isChannelArr(r['outputChannels'])) return null;
        patch.outputChannels = r['outputChannels'];
    }
    return patch;
};

const sanitize = (raw: unknown): StoredLayout[] => {
    if (!Array.isArray(raw)) return [];
    const result: StoredLayout[] = [];
    for (const item of raw) {
        if (typeof item !== 'object' || !item) continue;
        const r = item as Record<string, unknown>;
        if (typeof r['id'] !== 'string' || !isValidInput(r)) continue;
        result.push({
            id: r['id'] as string,
            ...(validateInput(r) as LayoutInput),
        });
    }
    return result;
};

export class LayoutStore {
    private readonly file: string;
    private layouts: StoredLayout[] = [];
    readonly ready: Promise<void>;

    constructor(dataDir: string) {
        this.file = path.join(dataDir, 'layouts.json');
        this.ready = this.load();
    }

    private async load() {
        const [, raw] = await noTryAsync(() => fs.readFile(this.file, 'utf8'));
        if (!raw) return;
        const [, parsed] = noTry(() => JSON.parse(raw));
        if (parsed) this.layouts = sanitize(parsed);
    }

    list(): StoredLayout[] {
        return [...this.layouts];
    }

    get(id: string): StoredLayout | undefined {
        return this.layouts.find(l => l.id === id);
    }

    async create(input: LayoutInput): Promise<StoredLayout> {
        const layout: StoredLayout = { id: UUID.generate(), ...input };
        this.layouts.push(layout);
        await this.persist();
        return layout;
    }

    async update(id: string, patch: LayoutPatch): Promise<StoredLayout | null> {
        const idx = this.layouts.findIndex(l => l.id === id);
        if (idx < 0) return null;
        this.layouts[idx] = { ...this.layouts[idx], ...patch };
        await this.persist();
        return this.layouts[idx];
    }

    async remove(id: string): Promise<boolean> {
        const idx = this.layouts.findIndex(l => l.id === id);
        if (idx < 0) return false;
        this.layouts.splice(idx, 1);
        await this.persist();
        return true;
    }

    private async persist() {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(this.layouts, null, 2), 'utf8');
        await fs.rename(tmp, this.file);
    }
}
