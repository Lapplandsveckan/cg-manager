/** Single registry of every query key in the app. Undo scopes
 *  (`route:<id>`, `rundown:<id>:...`, `config`) are a deliberately separate
 *  string namespace — don't unify them with these. */
export const qk = {
    routes: ['routes'] as const,
    rundowns: ['rundowns'] as const,
    rundownEntries: (id: string) => ['rundown', id] as const,
    rundownMeta: ['rundown-meta'] as const,
    rundownTypes: ['rundown-meta', 'types'] as const,
    rundownActions: ['rundown-meta', 'actions'] as const,
    media: ['media'] as const,
    mediaFolders: ['media-folders'] as const,
    casparStatus: ['caspar', 'status'] as const,
    casparConfig: ['caspar', 'config'] as const,
    casparRunningConfig: ['caspar', 'running-config'] as const,
    capabilities: ['caspar', 'capabilities'] as const,
    plugins: ['plugins'] as const,
    version: ['version'] as const,
};
