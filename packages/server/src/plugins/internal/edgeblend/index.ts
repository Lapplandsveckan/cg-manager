import fs from 'fs';
import path from 'path';
import { CasparPlugin, Transform, UI_INJECTION_ZONE } from '@lappis/cg-manager';
import { WebsocketOutboundMethod } from 'rest-exchange-protocol';
import {
    EdgeblendEffect,
    type EdgeBlendEffectOptions,
} from './effects/edgeblend';
import {
    LayoutStore,
    validateInput,
    validatePatch,
    type StoredLayout,
} from './layouts';
import { overlapFractions, projectorRects } from './geometry';

export default class EdgeblendPlugin extends CasparPlugin {
    public static get minChannels() {
        return 0;
    }

    public static get pluginName() {
        return 'edgeblend';
    }

    private store!: LayoutStore;
    private effects: Map<string, EdgeblendEffect[]> = new Map();
    private routes: ReturnType<typeof this.api.registerRoute>[] = [];

    private readonly handleReconnect = () => {
        this.disableAll();
        void this.enableAllActive();
    };

    protected async onEnable() {
        const dataDir = path.join(process.cwd(), 'plugin-data', 'edgeblend');
        this.store = new LayoutStore(dataDir);
        await this.store.ready;

        this.api.registerEffect(
            'edgeblend',
            (group, options) =>
                new EdgeblendEffect(group, options as EdgeBlendEffectOptions),
        );

        this.registerRoutes();
        this.api.registerUI(
            UI_INJECTION_ZONE.PLUGIN_PAGE,
            this.uiFile('index'),
        );
        this.api.onReconnect(this.handleReconnect);

        void this.api
            .awaitConnection()
            .then(() => this.enableAllActive())
            .catch(() => {
                /* executor unavailable — effects will not activate */
            });
    }

    protected onDisable() {
        this.api.offReconnect(this.handleReconnect);
        for (const route of this.routes) this.api.unregisterRoute(route);
        this.routes = [];
        this.disableAll();
    }

    private uiFile(name: string) {
        const base = path.join(__dirname, 'ui', name);
        return fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.jsx`;
    }

    private broadcast() {
        this.api.broadcast(
            'layouts',
            WebsocketOutboundMethod.UPDATE,
            this.store.list(),
        );
    }

    private registerRoutes() {
        this.routes.push(
            this.api.registerRoute(
                'layouts',
                async () => {
                    await this.store.ready;
                    return this.store.list();
                },
                'GET',
            ),
            this.api.registerRoute(
                'layouts',
                async req => {
                    const input = validateInput(req.getData());
                    if (!input) return null;
                    await this.store.ready;
                    const layout = await this.store.create(input);
                    if (layout.enabled) void this.enableLayout(layout);
                    this.broadcast();
                    return layout;
                },
                'ACTION',
            ),
            this.api.registerRoute(
                'layouts/:id',
                async req => {
                    const { id } = req.getParams();
                    const patch = validatePatch(req.getData());
                    if (!patch) return null;
                    await this.store.ready;
                    const prev = this.store.get(id);
                    const layout = await this.store.update(id, patch);
                    if (!layout) return null;

                    // Geometry or enable state changed — re-apply live
                    const geomChanged =
                        patch.canvasSize !== undefined ||
                        patch.projectorSize !== undefined ||
                        patch.size !== undefined ||
                        patch.inputChannel !== undefined ||
                        patch.outputChannels !== undefined;
                    const wasEnabled = prev?.enabled ?? false;

                    if (wasEnabled || layout.enabled || geomChanged) {
                        this.disableLayout(id);
                        if (layout.enabled) void this.enableLayout(layout);
                    }

                    this.broadcast();
                    return layout;
                },
                'UPDATE',
            ),
            this.api.registerRoute(
                'layouts/:id',
                async req => {
                    const { id } = req.getParams();
                    await this.store.ready;
                    this.disableLayout(id);
                    await this.store.remove(id);
                    this.broadcast();
                    return { ok: true };
                },
                'DELETE',
            ),
        );
    }

    // --- Effect lifecycle ---

    private enableAllActive() {
        return Promise.all(
            this.store
                .list()
                .filter(l => l.enabled)
                .map(l => this.enableLayout(l)),
        );
    }

    private disableAll() {
        for (const [id] of this.effects) this.disableLayout(id);
    }

    private disableLayout(id: string) {
        const effects = this.effects.get(id) ?? [];
        effects.forEach(e => e.deactivate());
        this.effects.delete(id);
    }

    private enableLayout(layout: StoredLayout) {
        this.disableLayout(layout.id);

        const { canvasSize } = layout;
        const [overlapX, overlapY] = overlapFractions(
            canvasSize,
            layout.projectorSize,
            layout.size,
        );
        const rects = projectorRects(
            canvasSize,
            layout.projectorSize,
            layout.size,
        );

        const effects: EdgeblendEffect[] = [];
        this.effects.set(layout.id, effects);

        const promises = [];
        for (let i = 0; i < layout.outputChannels.length; i++) {
            const rect = rects[i];
            const outputCh = layout.outputChannels[i];
            const channel = this.api.getChannel(outputCh);

            const blendEdges: [number, number, number, number] = [
                overlapX,
                overlapX,
                overlapY,
                overlapY,
            ];
            if (rect.col === 0) blendEdges[0] = 0;
            if (rect.col === layout.size[0] - 1) blendEdges[1] = 0;
            if (rect.row === 0) blendEdges[2] = 0;
            if (rect.row === layout.size[1] - 1) blendEdges[3] = 0;

            const sourceTransform = [
                rect.x / canvasSize[0],
                rect.y / canvasSize[1],
                (rect.x + layout.projectorSize[0]) / canvasSize[0],
                (rect.y + layout.projectorSize[1]) / canvasSize[1],
            ] as const;

            const transform = new Transform(
                Transform.getRect(...sourceTransform),
                Transform.normalRect(),
            );

            const inputChannel = this.api.getChannel(layout.inputChannel);
            const effect = new EdgeblendEffect(channel.getGroup('edgeblend'), {
                source: inputChannel,
                transform,
                edgeblend: { edgeblend: blendEdges, g: 1.8, p: 3, a: 0.5 },
            });

            effects.push(effect);
            promises.push(effect.activate());
        }

        return Promise.all(promises);
    }
}
