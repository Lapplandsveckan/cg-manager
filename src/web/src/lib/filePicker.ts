// Small wrapper over `<input type="file">`. We previously polyfilled the File
// System Access API, but that touched browser prototypes and only one call site
// ever used a single method from the picker handle — overkill. This works in
// every browser without mutating anything global, and returns plain Files.

export interface FilePickerAcceptType {
    /** Human-readable description, kept for API parity with FS Access API. */
    description?: string;
    /** Map of MIME type → list of file extensions (e.g. `{"image/*": [".png"]}`). */
    accept: Record<string, string[]>;
}

export interface PickFilesOptions {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
}

function buildAcceptAttribute(types?: FilePickerAcceptType[]): string {
    if (!types?.length) return '';
    const parts = new Set<string>();
    for (const type of types) 
        for (const [mime, exts] of Object.entries(type.accept)) {
            if (mime) parts.add(mime);
            for (const ext of exts) {
                if (!ext) continue;
                parts.add(ext.startsWith('.') ? ext : `.${ext}`);
            }
        }
    
    return Array.from(parts).join(',');
}

/**
 * Opens a native file picker. Resolves with the selected files, or an empty
 * array if the user cancels. Must be invoked synchronously inside a user
 * gesture (e.g. a click handler) — otherwise the browser may block it.
 */
export function pickFiles(options: PickFilesOptions = {}): Promise<File[]> {
    if (typeof document === 'undefined') return Promise.resolve([]);

    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    if (options.multiple) input.multiple = true;
    const accept = buildAcceptAttribute(options.types);
    if (accept) input.accept = accept;

    document.body.appendChild(input);

    return new Promise<File[]>((resolve) => {
        let settled = false;
        const finish = (files: File[]) => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(files);
        };

        input.addEventListener('change', () => {
            finish(input.files ? Array.from(input.files) : []);
        }, { once: true });

        // Modern browsers (Chrome 113+, Firefox 91+, Safari 17+) fire `cancel`
        // when the user dismisses the picker. Older browsers won't — the
        // promise just stays pending in that case, which is acceptable for our
        // use case (the upload modal won't open until the user picks a file).
        input.addEventListener('cancel', () => finish([]), { once: true });

        input.click();
    });
}
