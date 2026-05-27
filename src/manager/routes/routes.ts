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
    /** Eight numbers — quad corners in TL, TR, BR, BL order
     *  (`[tlX, tlY, trX, trY, brX, brY, blX, blY]`). Forwarded to CasparCG's
     *  MIXER PERSPECTIVE for non-affine warps. */
    perspective?: number[];

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

    // Emitted on the CasparManager so api/server.ts can forward to all WS
    // clients on the `routes` topic. Lets the UI live-update on changes
    // made anywhere (API endpoint, plugin rundown action, internal caller)
    // without polling.
    private notify(method: 'CREATE' | 'UPDATE' | 'DELETE', data: VideoRoute | string) {
        this.manager.emit('route-change', {method, data});
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

        this.notify('CREATE', route);
        return route;
    }

    public getVideoRoute(id: string): VideoRoute | null {
        return this.routes.get(id)?.route ?? null;
    }

    public getVideoRoutes(): VideoRoute[] {
        return Array.from(this.routes.values()).map(({route}) => route);
    }

    public async updateVideoRoute(data: VideoRoute) {
        const state = this.routes.get(data.id);
        if (!state) return;

        // Replace the route reference instead of mutating it with
        // Object.assign — Object.assign leaves any field that's missing from
        // `data` in place, which makes it impossible to clear a
        // previously-set transform/perspective/edgeblend. The StatefulVideoRoute
        // wrapper stays the same, so anything keying off the state map
        // (effects, persistence) keeps working.
        state.route = data;
        state.enabled = data.enabled ?? state.enabled;

        this.checkState(data.id, true);
        this.checkState(data.id);

        await this.saveVideoRoute(data);
        this.notify('UPDATE', data);
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
        const dir = config['routes-dir'];
        const file = path.join(dir, `${route.id}.json`);

        const content = JSON.stringify(route, null, 2);
        const [err] = await noTryAsync(() => fs.writeFile(file, content));
        if (!err) return;

        Logger.error(`Failed to save route ${route.id} (${file})`);
        Logger.error(err);
    }

    public async deleteVideoRoute(id: string) {
        const existed = this.routes.has(id);
        this.checkState(id, true);
        this.routes.delete(id);

        if (existed) this.notify('DELETE', id);

        const dir = config['routes-dir'];
        const file = path.join(dir, `${id}.json`);

        const [err] = await noTryAsync(() => fs.unlink(file));
        if (!err || err['code'] === 'ENOENT') return;

        Logger.error(`Failed to delete route ${id} (${file})`);
        Logger.error(err);
    }

    public enableVideoRoute(id: string) {
        const state = this.routes.get(id);
        if (!state) return;
        if (state.route.enabled && state.enabled) return;

        // Keep the wrapper's runtime flag and the inner route's persisted
        // flag in sync, and write to disk so the choice survives a restart.
        state.enabled = true;
        state.route.enabled = true;
        this.checkState(id);
        this.saveVideoRoute(state.route);
        this.notify('UPDATE', state.route);
    }

    public disableVideoRoute(id: string) {
        const state = this.routes.get(id);
        if (!state) return;
        if (!state.route.enabled && !state.enabled) return;

        state.enabled = false;
        state.route.enabled = false;
        this.checkState(id);
        this.saveVideoRoute(state.route);
        this.notify('UPDATE', state.route);
    }

    // PluginAPI.setVideoRouteEnabled (in @lappis/cg-manager) delegates here;
    // without this method, every plugin call no-ops with a swallowed
    // "not a function" error.
    public setVideoRouteEnabled(id: string, enabled: boolean) {
        if (enabled) this.enableVideoRoute(id);
        else this.disableVideoRoute(id);
    }

    public disposeAll() {
        for (const id of this.routes.keys()) this.checkState(id, true);
        this.routes.clear();
    }

    /**
     * Called when CasparCG reconnects after a disconnect: existing Effect
     * instances are now stale references against a CasparCG that has just
     * been wiped. Tear them down and re-create from the persisted route
     * data so enabled routes start playing again automatically.
     */
    public refreshAfterReconnect() {
        if (this.routes.size === 0) return;
        Logger.info(`Refreshing ${this.routes.size} video route${this.routes.size === 1 ? '' : 's'} after CasparCG reconnect`);
        for (const id of this.routes.keys()) {
            this.checkState(id, true); // dispose stale effect
            this.checkState(id);        // re-create + re-activate if enabled
        }
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
        const { transform, edgeblend, perspective } = route;
        const {type, ...data} = src;
        const options = {transform, edgeblend, perspective, ...data};

        if (type === 'decklink') return this.manager.effects.create('decklink', group, options);
        if (type === 'video') return this.manager.effects.create('video', group, options);
        if (type === 'color') return this.manager.effects.create('color', group, options);

        if (type === 'channel') {
            const channelId = (data as ChannelSource).channel;
            // Don't lazy-allocate channels that aren't in CasparCG's running
            // config — issuing a ROUTE against a non-existent channel triggers
            // an AMCP error which (in dev) bounces the socket and re-runs this
            // path on reconnect: infinite tight loop. Fall back to black so the
            // host stays in a coherent state until the route is reconfigured.
            const channels = this.manager.caspar.config?.channels;
            const channelExists = channels && channelId >= 1 && channelId <= channels.length;
            const channel = channelExists ? this.executor.getChannel(channelId) : null;
            if (!channel) {
                Logger.warn(`Channel ${channelId} not available — falling back to black`);
                return this.manager.effects.create('color', group, {
                    color: 'black', transform, edgeblend, perspective,
                });
            }

            return this.manager.effects.create('route', group, {channel, edgeblend, transform, perspective});
        }

        Logger.warn(`Unknown source type: ${type}`);
    }
}
