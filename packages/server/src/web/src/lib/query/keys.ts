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
    pluginInjections: ['plugin-injections'] as const,
    version: ['version'] as const,
};

/** Mutation-key registry, one entry per operation — lets
 *  `queryClient.isMutating({ mutationKey })` target one of them (the undo
 *  re-entrancy guard uses `qm.undo`). A separate namespace from `qk`, not a
 *  cache-addressing one. */
export const qm = {
    routeCreate: ['route', 'create'] as const,
    routeUpdate: ['route', 'update'] as const,
    routeDelete: ['route', 'delete'] as const,
    routeSetEnabled: ['route', 'setEnabled'] as const,
    rundownCreate: ['rundown', 'create'] as const,
    rundownRename: ['rundown', 'rename'] as const,
    rundownDelete: ['rundown', 'delete'] as const,
    entryCreate: ['rundown-entry', 'create'] as const,
    entryUpdate: ['rundown-entry', 'update'] as const,
    entryDelete: ['rundown-entry', 'delete'] as const,
    entriesReorder: ['rundown-entry', 'reorder'] as const,
    casparConfigUpdate: ['caspar', 'config', 'update'] as const,
    pluginSetEnabled: ['plugin', 'setEnabled'] as const,
    pluginUninstall: ['plugin', 'uninstall'] as const,
    pluginSetVersion: ['plugin', 'setVersion'] as const,
    pluginDeleteVersion: ['plugin', 'deleteVersion'] as const,
    undo: ['undo'] as const,
};
