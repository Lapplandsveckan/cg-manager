import {UUID} from '../../util/uuid';
import config from '../../util/config';
import {noTryAsync} from 'no-try';
import fs from 'fs/promises';
import {Logger} from '../../util/log';
import path from 'path';
import {Effect, EffectGroup} from '@lappis/cg-manager';
import {CasparManager} from '../index';
import {CasparExecutor} from '../caspar/executor';

interface DecklinkSource {
    device: number;
    format: string;

    keyDevice?: number;

    type: 'decklink';
}

interface VideoSource {
    video: string;
    type: 'video';
}

interface ChannelSource {
    channel: number;
    type: 'channel';
}

interface ColorSource {
    color: string;
    type: 'color';
}

interface EffectGroupDestination {
    effectLayer: string;
    index?: number;

    type: 'effect-group';
}

type Source = DecklinkSource | VideoSource | ChannelSource | ColorSource;
type Destination = EffectGroupDestination;

interface VideoRoute {
    id: string;
    name: string;

    transform?: number[];
    edgeblend?: number[];

    source: Source;
    destination: Destination;

    enabled: boolean;
    metadata?: Record<string, any>;
}

interface StatefulVideoRoute {
    route: VideoRoute;
    enabled: boolean;

    _enabled?: boolean;
    _effect?: Effect;
}

export class VideoRoutesManager {
    private routes = new Map<string, StatefulVideoRoute>();
    private executor: CasparExecutor;
    private manager: CasparManager;

    public constructor(manager: CasparManager) {
        this.manager = manager;
        this.executor = manager.executor;
    }

    public createVideoRoute(data: Omit<VideoRoute, 'id'>): VideoRoute {
        const id = UUID.generate();
        const route = {
            id,
            ...data,
        } as VideoRoute;

        this.routes.set(id, {route, enabled: route.enabled ?? true});
        this.checkState(route.id);
        this.saveVideoRoute(route);

        return route;
    }

    public getVideoRoute(id: string): VideoRoute | null {
        return this.routes.get(id)?.route ?? null;
    }

    public getVideoRoutes(): VideoRoute[] {
        return Array.from(this.routes.values()).map(({route}) => route);
    }

    public async updateVideoRoute(data: VideoRoute) {
        const route = this.getVideoRoute(data.id);
        if (!route) return;

        Object.assign(route, data);

        // remove old state, and reapply
        this.checkState(route.id, true);
        this.checkState(route.id);

        await this.saveVideoRoute(route);
    }

    public async loadVideoRoutes() {
        const dir = config['routes-dir'];
        const [err, files] = await noTryAsync(() => fs.readdir(dir));
        if (err) {
            Logger.error('Failed to read route dir');
            Logger.error(err);
            return;
        }

        const routes: VideoRoute[] = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
            const content = await fs.readFile(path.join(dir, file), 'utf8').catch(e => {
                Logger.error(`Failed to read route (${file})`);
                Logger.error(e);
                return null;
            });

            return content && JSON.parse(content);
        }));

        routes
            .filter(Boolean)
            .forEach(route => {
                this.routes.set(route.id, {route, enabled: route.enabled ?? true});
                this.checkState(route.id);
            });
    }

    public async saveVideoRoute(route: VideoRoute) {
        const dir = config['route-dir'];
        const file = path.join(dir, `${route.id}.json`);

        const content = JSON.stringify(route, null, 2);
        const [err] = await noTryAsync(() => fs.writeFile(file, content));
        if (!err) return;

        Logger.error(`Failed to save route ${route.id} (${file})`);
        Logger.error(err);
    }

    public async deleteVideoRoute(id: string) {
        this.checkState(id, true);
        this.routes.delete(id);

        const dir = config['route-dir'];
        const file = path.join(dir, `${id}.json`);

        const [err] = await noTryAsync(() => fs.unlink(file));
        if (!err || err['code'] === 'ENOENT') return;

        Logger.error(`Failed to delete route ${id} (${file})`);
        Logger.error(err);
    }

    public enableVideoRoute(id: string) {
        const route = this.routes.get(id);
        if (!route) return;

        route.enabled = true;
        this.checkState(id);
    }

    public disableVideoRoute(id: string) {
        const route = this.routes.get(id);
        if (!route) return;

        route.enabled = false;
        this.checkState(id);
    }


    private checkState(route: string, removal = false) {
        const state = this.routes.get(route);
        if (!state) return;

        if (removal) {
            if (state._enabled)
                state._effect.dispose();

            delete state._effect;
            delete state._enabled;
            return;
        }

        if (typeof state._enabled === 'undefined') {
            const group = this.getDestination(state.route.destination);
            state._effect = this.getSource(state.route.source, group, state.route);
            state._enabled = false;
        }

        if (state._enabled === state.enabled) return;
        state._enabled = state.enabled;

        if (state._enabled) state._effect.activate();
        if (!state._enabled) state._effect.deactivate();
    }

    private getDestination(dest: Destination): EffectGroup {
        if (dest.type === 'effect-group') return this.executor.getEffectGroup(dest.effectLayer, dest.index);

        Logger.warn(`Unknown destination type: ${dest.type}`);
    }

    private getSource(src: Source, group: EffectGroup, route: VideoRoute): Effect {
        const { transform, edgeblend } = route;
        const {type, ...data} = src;
        const options = {transform, edgeblend, ...data};

        if (type === 'decklink') return this.manager.effects.create('decklink', group, options);
        if (type === 'video') return this.manager.effects.create('video', group, options);
        if (type === 'color') return this.manager.effects.create('color', group, options);

        if (type === 'channel') {
            const channel = this.executor.getChannel((data as ChannelSource).channel);
            if (!channel) {
                Logger.warn(`Channel not found: ${(data as ChannelSource).channel}`);
                return this.manager.effects.create('color', group, {color: 'black', transform, edgeblend});
            }

            return this.manager.effects.create('route', group, {channel, edgeblend, transform});
        }

        Logger.warn(`Unknown source type: ${type}`);
    }
}
