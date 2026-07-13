import {
    Effect,
    type EffectGroup,
    PlayCommand,
    StopCommand,
    Transform,
    type BasicChannel,
    MixerCommand,
} from '@lappis/cg-manager';

type Tuple<T, N extends number> = N extends N
    ? number extends N
        ? T[]
        : _TupleOf<T, N, []>
    : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
    ? R
    : _TupleOf<T, N, [T, ...R]>;

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

        if (options.transform)
            this.setTransform(Transform.fromArray(options.transform));
    }

    protected get layer() {
        return this.layers[0];
    }

    protected applyEdgeblend() {
        if (!this.active) return;
        if (!this.options.edgeblend) return;

        const [...points] = this.options.edgeblend.slice(0, 4) as [
            number,
            number,
            number,
            number,
        ];
        const [g, p, a] = this.options.edgeblend.slice(4);

        for (const layer of this.layers)
            this.executor.execute(
                MixerCommand.create()
                    .edgeblend({ edgeblend: points, g, p, a })
                    .allocate(layer),
            );
    }

    /* eslint-disable camelcase */
    protected applyPerspective() {
        if (!this.active) return;
        if (!this.options.perspective) return;

        const p = this.options.perspective;
        const perspective = {
            top_left: { x: p[0], y: p[1] },
            top_right: { x: p[2], y: p[3] },
            bottom_right: { x: p[4], y: p[5] },
            bottom_left: { x: p[6], y: p[7] },
        };

        for (const layer of this.layers)
            this.executor.execute(
                MixerCommand.create().perspective(perspective).allocate(layer),
            );
    }
    /* eslint-enable camelcase */

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

    public getMetadata(): Record<string, unknown> {
        return {};
    }
}
