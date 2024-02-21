import { v4 as uuid } from 'uuid';
import webpack from 'webpack';
import MemoryFS from 'memory-fs';
import path from 'path';
import {Logger} from '../../util/log';
export const UI_INJECTION_ZONE = {
    EFFECT_CREATOR: 'effect-creator',
} as const;

export type UI_INJECTION_ZONE = typeof UI_INJECTION_ZONE[keyof typeof UI_INJECTION_ZONE];

export interface Injection {
    zone: UI_INJECTION_ZONE;
    file: string;
    plugin: string;
    id: string;
}
export class UIInjector {
    private _injectionsZones = new Map<UI_INJECTION_ZONE, Injection[]>();
    private _injections = new Map<string, Injection>();
    private bundledComponents = new Map<string, string | Promise<string>>();

    public register(zone: UI_INJECTION_ZONE, file: string, plugin: string) {
        if (!this._injectionsZones.has(zone)) this._injectionsZones.set(zone, []);

        const obj = { zone, file, plugin, id: uuid() };
        this._injectionsZones.get(zone).push(obj);
        this._injections.set(obj.id, obj);

        this.bundle(obj.id); // should we bundle here, or only when requested?
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

    public getInjections(zone?: UI_INJECTION_ZONE) {
        if (zone) return this._injectionsZones.get(zone) || [];
        return Array.from(this._injections.values());
    }

    public async bundle(id: string) {
        if (this.bundledComponents.has(id)) return this.bundledComponents.get(id);

        const path = this._injections.get(id)?.file;
        if (!path) return null;

        const promise = bundleFile(path);
        this.bundledComponents.set(id, promise);

        const file = await promise;
        this.bundledComponents.set(id, file);

        Logger.scope('UIInjector').info(`Bundled ${path}`);

        return file;
    }
}

function getConfig(entry: string) {
    return {
        mode: 'production', // Set mode to development
        entry, // Entry point of your application
        output: {
            libraryTarget: 'module', // Set library target to commonjs2 to export as a module
            path: '/', // Output directory
            filename: 'bundle.js', // Output file name
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx|ts|tsx)$/, // Transpile JavaScript and TypeScript files
                    exclude: /node_modules/, // Exclude node_modules directory
                    use: {
                        loader: require.resolve('babel-loader'), // Use Babel loader
                        options: {
                            presets: [
                                require.resolve('@babel/preset-env'),
                                require.resolve('@babel/preset-react'),
                                require.resolve('@babel/preset-typescript'),
                            ], // Babel presets for handling ES6+, React, and TypeScript
                        },
                    },
                },
            ],
        },
        resolve: {
            extensions: ['.js', '.jsx', '.ts', '.tsx'], // File extensions to resolve
            modules: [
                path.resolve(__dirname, '../../../', 'node_modules'), // Specify the correct path to node_modules
                'node_modules', // Fallback to 'node_modules' to ensure compatibility with packages installed globally
            ],
        },
        externalsType: 'window',
        externals: {
            react: 'React', // Use external version of React
            '@mui/material': 'MaterialUI',
        },
        experiments: {
            outputModule: true, // Enable output module
        },
        target: 'web', // Compile for usage in a browser-like environment
    } as webpack.Configuration;
}

function bundleFile(file: string) {
    const memfs = new MemoryFS();

    const config = getConfig(file);
    const compiler = webpack(config);
    compiler.outputFileSystem = memfs;

    return new Promise<string>((resolve, reject) => {
        compiler.run((err, stats) => {
            if (err || stats.hasErrors()) return reject(stats.hasErrors() ? stats.compilation.errors : err);
            resolve(memfs.readFileSync('/bundle.js').toString());
        });
    });
}