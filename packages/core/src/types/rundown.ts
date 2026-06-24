export interface RundownItem {
    id: string;
    title: string;

    type: string;
    data: any;

    metadata: {
        autoNext: boolean;
    };
}

export interface Rundown {
    id: string;
    name: string;

    items: RundownItem[];
}

/**
 * Drag-and-drop contract payload. Mirrors the shape the host's web bundle
 * reads off the `application/x-cg-rundown-item` MIME type. Exposed here so
 * `RundownActionFileAccept.match` can return one without the plugin needing
 * to depend on the host's web lib.
 */
export interface RundownItemDragPayload {
    /** Registered rundown action type. */
    type: string;
    /** Pre-filled item.data. */
    data?: unknown;
    /** Pre-filled item.title. */
    title?: string;
}

export interface RundownActionFileAccept {
    /** Coarse client-side hint (MIME globs / extensions, same shape as
     *  Dropzone.accept). Used only to decide whether to light up the
     *  drop overlay on dragenter — `match` is the authoritative gate.
     *  Omit to opt into every file drag. */
    fileTypes?: string[];
    /** Server-side destination prefix. Trailing slash. Defaults to "" (media root). */
    destination?: string;
    /** Authoritative match. Runs server-side on drop. Return null to
     *  decline, or a payload to claim the file. `file.path` is
     *  pre-computed as `destination + file.name`. */
    match: (file: {
        name: string;
        type: string;
        size: number;
        path: string;
    }) => RundownItemDragPayload | null;
}

export interface RundownActionMetadata {
    accepts?: RundownActionFileAccept;
    stop?: (item: RundownItem) => Promise<void> | void;
    // Future: displayName, description, category, iconKey (per CLAUDE.md plan).
}

export declare class RundownManager {
    private rundowns: Map<string, Rundown>;
    public executor: RundownExecutor;

    public createRundown(name: string): Rundown;
    public getRundown(id: string): Rundown | null;
    public getRundowns(): Rundown[];

    public loadRundowns(): Promise<void>;
    public saveRundown(rundown: Rundown): Promise<void>;
    public deleteRundown(id: string): Promise<void>;
}

export declare class RundownExecutor {
    /** Register a rundown action handler. `owner` is set by the PluginAPI
     *  wrapper so the host can clean up on disable. `metadata` is optional —
     *  pass `{ accepts }` to opt into file-drop matching. */
    public registerAction(
        type: string,
        action: (item: RundownItem) => Promise<void> | void,
        owner?: string,
        metadata?: RundownActionMetadata,
    ): void;
    public executeItem(item: RundownItem): Promise<void>;
}