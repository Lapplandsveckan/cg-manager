import path from 'path';
import { v4 as uuid } from 'uuid';
import webpack from 'webpack';
import MemoryFS from 'memory-fs';
import { noTryAsync } from 'no-try';
import { Logger } from '../../util/log';
export const UI_INJECTION_ZONE = {
    PLUGIN_PAGE: 'plugin-page',

    // Contributes a top-level sidebar button + page (served at
    // /ext/:plugin[/:pageKey]). One registration = one button. Use a dotted
    // sub-zone (`navbar-page.<pageKey>`) to add more than one button per
    // plugin; a bare registration is the single-button case. The label/icon
    // are read from a `meta = { label, icon }` export on the page module
    // (label falls back to the page-key, then the plugin name; icon falls
    // back to a default).
    NAVBAR_PAGE: 'navbar-page',

    RUNDOWN_ITEM: 'rundown-item',
    RUNDOWN_EDITOR: 'rundown-editor',

    RUNDOWN_SIDE: 'rundown-side',
    RUNDOWN_BOTTOM_PANEL: 'rundown-bottom-panel',

    // Rendered inside the media upload modal while a file is being
    // uploaded; the host passes `targetPaths: string[]` (server-side
    // absolute paths) so injections can act on the in-flight files.
    UPLOAD_OPTIONS: 'upload-options',

    // Not rendered visually. Components injected here mount in a hidden div
    // and call `useRegisterContextMenuItems(surface, provider)` to contribute
    // items to host right-click menus. Use dotted sub-zones to target a
    // specific surface, e.g. `context-menu.rundown-item`.
    CONTEXT_MENU: 'context-menu',
} as const;

export type UI_INJECTION_ZONE =
    (typeof UI_INJECTION_ZONE)[keyof typeof UI_INJECTION_ZONE];
// A plugin can also define its own zone for other plugins to extend, in the
// form `plugin:<owner-defined-name>` — mirrors @lappis/cg-manager's
// types/ui.ts, keep both in sync.
export type UI_INJECTION_ZONE_KEY =
    | UI_INJECTION_ZONE
    | `${UI_INJECTION_ZONE}.${string}`
    | `plugin:${string}`;

export interface Injection {
    zone: UI_INJECTION_ZONE_KEY;
    file: string;
    plugin: string;
    id: string;
}
export class UIInjector {
    private _injectionsZones = new Map<UI_INJECTION_ZONE_KEY, Injection[]>();
    private _injections = new Map<string, Injection>();
    private bundledComponents = new Map<string, string | Promise<string>>();

    public register(zone: UI_INJECTION_ZONE_KEY, file: string, plugin: string) {
        if (!this._injectionsZones.has(zone))
            this._injectionsZones.set(zone, []);

        const obj = { zone, file, plugin, id: uuid() };
        this._injectionsZones.get(zone).push(obj);
        this._injections.set(obj.id, obj);

        this.bundle(obj.id);
        return obj.id;
    }

    public unregister(id: string) {
        const injection = this._injections.get(id);
        if (!injection) return;

        const zone = this._injectionsZones.get(injection.zone);
        if (zone) {
            const index = zone.findIndex(i => i.id === id);
            if (index > -1) zone.splice(index, 1);
        }

        this._injections.delete(id);
        this.bundledComponents.delete(id);
    }

    public getInjections(zone?: UI_INJECTION_ZONE_KEY) {
        if (zone) return this._injectionsZones.get(zone) || [];
        return Array.from(this._injections.values());
    }

    public async bundle(id: string) {
        if (this.bundledComponents.has(id))
            return this.bundledComponents.get(id);

        const path = this._injections.get(id)?.file;
        if (!path) return null;

        const promise = bundleFile(path).catch(e => {
            Logger.scope('UIInjector').error(`Failed to bundle ${path} - ${e}`);
            this.bundledComponents.delete(id);
            return '';
        });
        this.bundledComponents.set(id, promise);

        const [err, file] = await noTryAsync(() => promise);
        if (err) return null;

        this.bundledComponents.set(id, file);
        Logger.scope('UIInjector').debug(`Bundled ${path}`);

        return file;
    }

    public getInjectionZone(
        zone: UI_INJECTION_ZONE_KEY,
        key: string,
    ): UI_INJECTION_ZONE_KEY {
        return `${zone}.${key}` as const;
    }
}

function getConfig(entry: string) {
    return {
        mode: 'production',
        // Anchor webpack's resolution context to the snapshot/install root
        // (dist/manager/plugins/ -> ../../.. = /snapshot/manager) so that
        // babel-loader and module resolution work regardless of process.cwd(),
        // which the entrypoint chdirs to CASPAR_DIR at startup.
        context: path.resolve(__dirname, '../../../'),
        entry,
        output: {
            libraryTarget: 'module',
            path: '/',
            filename: 'bundle.js',
        },
        module: {
            rules: [
                {
                    // @babel/runtime helpers and some parser libs ship ESM .js files.
                    // Webpack's auto module-type detection misfires in the pkg snapshot
                    // (plugin on real disk, manager deps in /snapshot FS), so force
                    // javascript/auto globally instead of relying on path heuristics.
                    test: /\.m?js$/,
                    type: 'javascript/auto',
                    resolve: { fullySpecified: false },
                },
                {
                    test: /\.(js|jsx|ts|tsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: require.resolve('babel-loader'),
                        options: {
                            presets: [
                                [
                                    require.resolve('@babel/preset-env'),
                                    { targets: { chrome: 100 } },
                                ],
                                require.resolve('@babel/preset-react'),
                                require.resolve('@babel/preset-typescript'),
                            ],
                        },
                    },
                },
            ],
        },
        resolve: {
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
            modules: [
                path.resolve(__dirname, '../../../', 'node_modules'),
                'node_modules',
            ],
        },
        externalsType: 'window',
        externals: {
            react: 'React',
            '@mui/material': 'MaterialUI',
            'mui-color-input': 'MUIColorInput',
            '@web-lib': 'WebLib',
            i18next: 'i18n',
            'react-i18next': 'ReactI18next',
        },
        experiments: {
            outputModule: true,
        },
    } as webpack.Configuration;
}

function bundleFile(file: string) {
    const memfs = new MemoryFS();

    const config = getConfig(file);
    const compiler = webpack(config);
    compiler.outputFileSystem = memfs;

    return new Promise<string>((resolve, reject) => {
        compiler.run((err, stats) => {
            // Capture result before closing so we don't read memfs after
            // the compiler potentially clears its internal state.
            const result =
                err || stats.hasErrors()
                    ? {
                          err: stats.hasErrors()
                              ? stats.compilation.errors
                              : err,
                      }
                    : { bundle: memfs.readFileSync('/bundle.js').toString() };

            // Always close the compiler so webpack releases its input-fs
            // file handles — on Windows these can lock plugin source files.
            compiler.close(() => {
                if ('err' in result) reject(result.err);
                else resolve(result.bundle);
            });
        });
    });
}
