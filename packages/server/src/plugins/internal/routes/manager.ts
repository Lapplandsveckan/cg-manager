import fs from 'fs/promises';
import path from 'path';
import { noTry, noTryAsync } from 'no-try';
import {
    type Effect,
    type EffectGroup,
    type PluginAPI,
} from '@lappis/cg-manager';
import { type Client } from 'rest-exchange-protocol';
import { UUID } from '../../../util/uuid';
import { Logger } from '../../../util/log';
import { CasparManager } from '../../../manager';
import { VideoEffect, type VideoEffectOptions } from './effects/video';
import { RouteEffect, type RouteEffectOptions } from './effects/route';
import { ColorEffect, type ColorEffectOptions } from './effects/color';
import { DecklinkEffect, type DecklinkEffectOptions } from './effects/decklink';
import { type Destination, type Source, type VideoRoute } from './types';

export type RouteChangeMethod = 'CREATE' | 'UPDATE' | 'DELETE';

export type RouteChangeHandler = (
    method: RouteChangeMethod,
    data: VideoRoute | string,
    exclude?: Client,
) => void;

interface StatefulVideoRoute {
    route: VideoRoute;
    enabled: boolean;

    _enabled?: boolean;
    _effect?: Effect;
}

const logger = Logger.scope('Routes');

// MIGRATION-SHIM: see CLAUDE.md "Temporary migration shims"
const MIGRATED_MARKER = '.migrated';

const isJsonFile = (file: string) => file.endsWith('.json');

export class VideoRoutesManager {
    private routes = new Map<string, StatefulVideoRoute>();

    public constructor(
        private api: PluginAPI,
        private dataDir: string,
        private onChange: RouteChangeHandler,
    ) {}

    public create(data: Omit<VideoRoute, 'id'>, exclude?: Client): VideoRoute {
        const id = UUID.generate();
        const route = { id, ...data } as VideoRoute;

        this.routes.set(id, { route, enabled: route.enabled ?? true });
        this.checkState(id);
        void this.save(route);

        this.onChange('CREATE', route, exclude);
        return route;
    }

    public get(id: string): VideoRoute | null {
        return this.routes.get(id)?.route ?? null;
    }

    public list(): VideoRoute[] {
        return Array.from(this.routes.values(), ({ route }) => route);
    }

    public async update(data: VideoRoute, exclude?: Client) {
        const state = this.routes.get(data.id);
        if (!state) return;

        state.route = data;
        state.enabled = data.enabled ?? state.enabled;

        this.checkState(data.id, true);
        this.checkState(data.id);

        await this.save(data);
        this.onChange('UPDATE', data, exclude);
    }

    public async delete(id: string, exclude?: Client) {
        const existed = this.routes.has(id);
        this.checkState(id, true);
        this.routes.delete(id);

        if (existed) this.onChange('DELETE', id, exclude);

        const file = this.fileFor(id);
        const [err] = await noTryAsync(() => fs.unlink(file));
        if (!err || err['code'] === 'ENOENT') return;

        logger.error(`Failed to delete route ${id} (${file})`);
        logger.error(err);
    }

    public setEnabled(id: string, enabled: boolean, exclude?: Client) {
        const state = this.routes.get(id);
        if (!state) return;
        if (state.route.enabled === enabled && state.enabled === enabled)
            return;

        state.enabled = enabled;
        state.route.enabled = enabled;
        this.checkState(id);
        void this.save(state.route);
        this.onChange('UPDATE', state.route, exclude);
    }

    public async load(legacyDir?: string) {
        await fs.mkdir(this.dataDir, { recursive: true });
        await this.migrateLegacy(legacyDir);

        const [err, files] = await noTryAsync(() => fs.readdir(this.dataDir));
        if (err) {
            logger.error('Failed to read route dir');
            logger.error(err);
            return;
        }

        const routes = await Promise.all(
            files.filter(isJsonFile).map(file => this.read(file)),
        );

        routes.filter(Boolean).forEach(route =>
            this.routes.set(route.id, {
                route,
                enabled: route.enabled ?? true,
            }),
        );
    }

    public refreshEffects() {
        if (this.routes.size === 0) return;

        logger.info(
            `Refreshing ${this.routes.size} video route${this.routes.size === 1 ? '' : 's'}`,
        );
        for (const id of this.routes.keys()) {
            this.checkState(id, true);
            this.checkState(id);
        }
    }

    public disposeAll() {
        for (const id of this.routes.keys()) this.checkState(id, true);
        this.routes.clear();
    }

    private fileFor(id: string) {
        return path.join(this.dataDir, `${id}.json`);
    }

    private async read(file: string): Promise<VideoRoute | null> {
        const [err, content] = await noTryAsync(() =>
            fs.readFile(path.join(this.dataDir, file), 'utf8'),
        );
        if (err) {
            logger.error(`Failed to read route (${file})`);
            logger.error(err);
            return null;
        }

        const [parseErr, route] = noTry(() => JSON.parse(content));
        if (!parseErr) return route;

        logger.error(`Invalid route file (${file})`);
        logger.error(parseErr);
        return null;
    }

    private async save(route: VideoRoute) {
        const file = this.fileFor(route.id);
        const content = JSON.stringify(route, null, 2);
        const [err] = await noTryAsync(() => fs.writeFile(file, content));
        if (!err) return;

        logger.error(`Failed to save route ${route.id} (${file})`);
        logger.error(err);
    }

    // MIGRATION-SHIM: see CLAUDE.md "Temporary migration shims"
    private async migrateLegacy(legacyDir?: string) {
        if (!legacyDir) return;

        const marker = path.join(this.dataDir, MIGRATED_MARKER);
        const [, migrated] = await noTryAsync(() => fs.stat(marker));
        if (migrated) return;

        const [err, legacy] = await noTryAsync(() => fs.readdir(legacyDir));
        if (err) return;

        const files = legacy.filter(isJsonFile);
        await Promise.all(
            files.map(file =>
                noTryAsync(() =>
                    fs.copyFile(
                        path.join(legacyDir, file),
                        path.join(this.dataDir, file),
                    ),
                ),
            ),
        );
        await noTryAsync(() => fs.writeFile(marker, ''));

        if (files.length === 0) return;
        logger.info(
            `Migrated ${files.length} video route(s) from ${legacyDir} to ${this.dataDir}`,
        );
    }

    private checkState(id: string, removal = false) {
        const state = this.routes.get(id);
        if (!state) return;

        if (removal) {
            if (state._enabled) state._effect.dispose();

            delete state._effect;
            delete state._enabled;
            return;
        }

        if (typeof state._enabled === 'undefined') {
            const group = this.getDestination(state.route.destination);
            state._effect = this.getSource(
                state.route.source,
                group,
                state.route,
            );
            state._enabled = false;
        }

        if (state._enabled === state.enabled) return;
        state._enabled = state.enabled;

        if (state._enabled) state._effect.activate();
        if (!state._enabled) state._effect.deactivate();
    }

    private getDestination(dest: Destination): EffectGroup {
        if (dest.type === 'effect-group')
            return this.api.getEffectGroup(dest.effectLayer, dest.index);

        logger.warn(`Unknown destination type: ${dest.type}`);
    }

    private getSource(
        src: Source,
        group: EffectGroup,
        route: VideoRoute,
    ): Effect {
        const { transform, edgeblend, perspective } = route;
        const { type, ...data } = src;
        const options = { transform, edgeblend, perspective, ...data };

        if (type === 'decklink')
            return new DecklinkEffect(group, options as DecklinkEffectOptions);
        if (type === 'video')
            return new VideoEffect(group, options as VideoEffectOptions);
        if (type === 'color')
            return new ColorEffect(group, options as ColorEffectOptions);
        if (type === 'channel') return this.getChannelSource(group, route, src);

        logger.warn(`Unknown source type: ${type}`);
    }

    private getChannelSource(
        group: EffectGroup,
        route: VideoRoute,
        src: Extract<Source, { type: 'channel' }>,
    ): Effect {
        const { transform, edgeblend, perspective } = route;
        const channels = CasparManager.getManager().caspar.config?.channels;
        const channelExists =
            channels && src.channel >= 1 && src.channel <= channels.length;
        const channel = channelExists ? this.api.getChannel(src.channel) : null;

        if (channel)
            return new RouteEffect(group, {
                channel,
                edgeblend,
                transform,
                perspective,
            } as unknown as RouteEffectOptions);

        logger.warn(
            `Channel ${src.channel} not available — falling back to black`,
        );
        return new ColorEffect(group, {
            color: 'black',
            transform,
            edgeblend,
            perspective,
        } as ColorEffectOptions);
    }
}
