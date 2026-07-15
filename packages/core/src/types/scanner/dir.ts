export interface InternalMediaData {
    name: string;
    id: string;
    identifier: string;

    location: string;
    type: 'media' | 'template';
}

export declare class DirectoryManager {
    // This is a static method, so it will not be available from the plugin
    // public static getManager(): DirectoryManager;

    private constructor();

    initialize(mediaPath: string, templatePath: string): Promise<void>;

    createDirectories(): Promise<void>;
    deleteDirectories(): Promise<void>;

    public createDirectory(type: 'media' | 'template', from: string): Promise<InternalMediaData>;
    public deleteDirectory(id: string): Promise<void>;

    public getDirectory(id: string): Promise<InternalMediaData>;
}