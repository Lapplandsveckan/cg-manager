export const showOpenFilePicker = (options, ...args) => {
    if (globalThis.showOpenFilePicker) globalThis.showOpenFilePicker(options, ...args);

    const mapOfFiles = new WeakMap();
    const prototypeOfFileSystemHandle = FileSystemHandle.prototype;
    const prototypeOfFileSystemFileHandle = FileSystemFileHandle.prototype;

    const input = document.createElement('input');
    const getFileHandle = file => {
        const fileHandle = create(prototypeOfFileSystemFileHandle);
        mapOfFiles.set(fileHandle, file);

        return fileHandle;
    };
    const getAcceptType = type => values(Object(type?.accept)).join(',');
    const resolveFilePicker = (resolve, reject) => {
        input.click();
        input.addEventListener('change', () => {
            resolve([...input.files].map(getFileHandle));
            input.value = '';
        }, {once: true});

        input.addEventListener('cancel', () => {
            reject(new DOMException('The user aborted a request.'));
        }, {once: true});
    };

    const {
        create,
        defineProperties,
        getOwnPropertyDescriptors,
        values,
    } = Object;

    const {
        name,
        kind,
        ...descriptorsOfFileSystemHandle
    } = getOwnPropertyDescriptors(prototypeOfFileSystemHandle);

    const {
        getFile,
        ...descriptorsOfFileSystemFileHandle
    } = getOwnPropertyDescriptors(prototypeOfFileSystemFileHandle);

    input.type = 'file';

    defineProperties(prototypeOfFileSystemHandle, {
        ...descriptorsOfFileSystemHandle,
        ...getOwnPropertyDescriptors({
            get name() {
                // @ts-ignore
                return mapOfFiles.get(this)?.name ?? name.call(this);
            },
            get kind() {
                // @ts-ignore
                return mapOfFiles.has(this) ? 'file' : kind.call(this);
            },
        }),
    });

    defineProperties(prototypeOfFileSystemFileHandle, {
        ...descriptorsOfFileSystemFileHandle,
        ...getOwnPropertyDescriptors({
            async getFile() {
                // @ts-ignore
                return await mapOfFiles.get(this) || getFile.call(this);
            },
        }),
    });

    input.multiple = Boolean(options?.multiple);
    input.accept = [].concat(options?.types ?? []).map(getAcceptType).join(',');

    return new Promise(resolveFilePicker);
};

export interface ShowOpenFilePickerOptions {
    /** A boolean that indicates whether the picker should let the user apply file type filters. By default, this is `false`. */
    excludeAcceptAllOption?: boolean

    /** An ID to be associated with the directory. If the same ID is used for another picker, it will open the same directory. */
    id?: boolean

    /** A boolean that indicates whether the user can select multiple files. By default, this is `false`. */
    multiple?: boolean

    /** A well known directory ("desktop", "downloads") or `FileSystemHandle` to open the dialog in. */
    startIn?: string | FileSystemDirectoryHandle

    /** An array of file types that can be selected. */
    types?: FilePickerAcceptType[]
}

export interface FilePickerAcceptType {
    /** A string that describes the file type. */
    description?: string

    /**
     * An array of content types or file extensions that can be selected.
     * @example
     * ```js
     * [
     *   {
     *     description: "Images",
     *     accept: {
     *       "image/*": [".png", ".gif", ".jpeg", ".jpg"]
     *     }
     *   }
     * ]
     * ```
     */
    accept: Record<string, string[]>
}

export interface FileSystemFileHandle {
    /** A method that returns a File object representing the file's contents. */
    getFile(): Promise<File>

    /** A method that creates a writable stream for the file. */
    createWritable(): Promise<FileSystemWritableFileStream>

    /** A boolean that indicates whether the handle is for a directory. */
    isDirectory: boolean

    /** A property that indicates whether the handle is for a file. */
    isFile: boolean

    /** A method that returns the name of the file. */
    name: string
}

export interface FileSystemWritableFileStream {
    /** Writes data to the stream. */
    write(data: BufferSource | Blob | string | WriteParams): Promise<void>

    /** Seeks to a position in the stream. */
    seek(position: number): Promise<void>

    /** Truncates the file to the specified size. */
    truncate(size: number): Promise<void>

    /** Closes the stream. */
    close(): Promise<void>
}

export interface WriteParams {
    type: 'write'
    position?: number
    data: BufferSource | Blob | string
}
