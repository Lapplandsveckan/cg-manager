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

export declare class RundownManager {
    private rundowns: Map<string, Rundown>;
    public executor: RundownExecutor;

    public createRundown(name: string): Rundown;
    public getRundown(id: string): Rundown | null;

    public loadRundowns(): Promise<void>;
    public saveRundown(rundown: Rundown): Promise<void>;
    public deleteRundown(id: string): Promise<void>;
}

export declare class RundownExecutor {
    /** Register a rundown action handler. When `owner` is provided, the host
     *  attributes this action to that plugin and removes it automatically when
     *  the plugin is disabled. The `PluginAPI.registerRundownAction` wrapper
     *  always sets `owner` to the plugin's name. */
    public registerAction(type: string, action: (item: RundownItem) => Promise<void> | void, owner?: string): void;
    public executeItem(item: RundownItem): Promise<void>;
}