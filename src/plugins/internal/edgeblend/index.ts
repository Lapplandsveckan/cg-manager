import {BasicChannel, CasparPlugin, Transform} from '@lappis/cg-manager';
import {EdgeblendEffect, EdgeBlendEffectOptions} from './effects/edgeblend';

export interface Layout {
    canvasSize: [number, number];
    projectorSize: [number, number];

    size: [number, number]; // eg 2x2

    inputChannel: BasicChannel;
    outputChannels: BasicChannel[];
}

export default class EdgeblendPlugin extends CasparPlugin {
    private layouts: Layout[] = [];
    private effects: WeakMap<Layout, EdgeblendEffect[]> = new WeakMap();

    public static get pluginName() {
        return 'edgeblend';
    }

    protected onEnable() {
        this.api.registerEffect(
            'edgeblend',
            (group, options) => new EdgeblendEffect(group, options as EdgeBlendEffectOptions),
        );
    }

    public enableLayouts() {
        return Promise.all(this.layouts.map(layout => this.enableLayout(layout)));
    }

    public disableLayouts() {
        this.layouts.forEach(layout => this.disableLayout(layout));
    }

    public addLayout(layout: Layout) {
        this.layouts.push(layout);
    }

    public removeLayout(layout: Layout) {
        const index = this.layouts.indexOf(layout);
        if (index < 0) return;

        this.layouts.splice(index, 1);
        this.disableLayout(layout);
    }

    private disableLayout(layout: Layout) {
        const effects = this.effects.get(layout) || [];
        effects.forEach(effect => effect.deactivate());
        effects.length = 0;
    }

    private enableLayout(layout: Layout) {
        const effects = this.effects.get(layout) || [];
        this.effects.set(layout, effects);

        effects.forEach(effect => effect.deactivate());
        effects.length = 0;

        const totalProjectorSize = layout.size.map((v, i) => v * layout.projectorSize[i]);
        const canvasSize = layout.canvasSize;

        const overlap = totalProjectorSize
            .map((v, i) => (v - canvasSize[i]) / (v - layout.projectorSize[i]));

        const promises = [];
        for (let i = 0; i < layout.outputChannels.length; i++) {
            const channel = this.api['_manager'].executor.getChannel(layout.outputChannels[i].getCasparChannel());

            const x = i % layout.size[0];
            const y = Math.floor(i / layout.size[0]);

            const edgeblend = {
                edgeblend: [overlap[0], overlap[0], overlap[1], overlap[1]] as [number, number, number, number],
                g: 1.8,
                p: 3,
                a: 0.5,
            };

            if (x === 0) edgeblend.edgeblend[0] = 0;
            if (x === layout.size[0] - 1) edgeblend.edgeblend[1] = 0;

            if (y === 0) edgeblend.edgeblend[2] = 0;
            if (y === layout.size[1] - 1) edgeblend.edgeblend[3] = 0;

            const offset = [x, y]
                .map((v, i) => v * (layout.projectorSize[i] - overlap[i]));

            const sourceTransform = [
                offset[0] / canvasSize[0],
                offset[1] / canvasSize[1],
                (offset[0] + layout.projectorSize[0]) / canvasSize[0],
                (offset[1] + layout.projectorSize[1]) / canvasSize[1],
            ] as const;

            const transform = new Transform(Transform.getRect(...sourceTransform), Transform.normalRect());
            const effect = new EdgeblendEffect(channel.getGroup('edgeblend'), {
                source: layout.inputChannel,
                transform,
                edgeblend,
            });

            effects.push(effect);
            promises.push(effect.activate());
        }

        return Promise.all(promises);
    }
}