import {
    Effect,
    EffectGroup,
    PlayCommand,
    StopCommand,
    Transform,
    BasicChannel, MixerCommand,
} from '@lappis/cg-manager';

type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface RouteEffectOptions {
    channel: BasicChannel;

    edgeblend?: Tuple<number, 7>;
    transform?: Tuple<number, 8>;
    perspective?: Tuple<number, 8>;
}

export class RouteEffect extends Effect {
    protected options: RouteEffectOptions;

    public constructor(group: EffectGroup, options: RouteEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers();

        if (options.transform) this.setTransform(Transform.fromArray(options.transform));
    }

    protected get layer() {
        return this.layers[0];
    }

    protected applyEdgeblend() {
        if (!this.active) return;
        if (!this.options.edgeblend) return;

        const [...points] = this.options.edgeblend.slice(0, 4) as [number, number, number, number];
        const [g, p, a] = this.options.edgeblend.slice(4);

        for (const layer of this.layers)
            this.executor.execute(
                MixerCommand
                    .create()
                    .edgeblend({ edgeblend: points, g, p, a })
                    .allocate(layer),
            );
    }

    protected applyPerspective() {
        if (!this.active) return;
        if (!this.options.perspective) return;

        const perspective = {
            // eslint-disable-next-line camelcase
            top_left: { x: this.options.perspective[0], y: this.options.perspective[1] },
            // eslint-disable-next-line camelcase
            top_right: { x: this.options.perspective[2], y: this.options.perspective[3] },
            // eslint-disable-next-line camelcase
            bottom_right: { x: this.options.perspective[4], y: this.options.perspective[5] },
            // eslint-disable-next-line camelcase
            bottom_left: { x: this.options.perspective[6], y: this.options.perspective[7] },
        };

        for (const layer of this.layers)
            this.executor.execute(
                MixerCommand
                    .create()
                    .perspective(perspective)
                    .allocate(layer),
            );
    }

    public activate() {
        if (!super.activate()) return;
        this.applyEdgeblend();
        this.applyPerspective();

        const cmd = PlayCommand.route(this.options.channel);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;

        const cmd = new StopCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public getMetadata(): {} {
        return {};
    }
}
