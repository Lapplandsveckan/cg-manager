import {
    ClearCommand,
    Effect,
    EffectGroup, MixerCommand,
    PlayCommand,
    Transform,
} from '@lappis/cg-manager';


type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface ColorEffectOptions {
    color: string;

    edgeblend?: Tuple<number, 7>;
    transform?: Tuple<number, 8>;
}

export class ColorEffect extends Effect {
    protected options: ColorEffectOptions;

    public constructor(group: EffectGroup, options: ColorEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers();

        if (options.transform) this.setTransform(Transform.fromArray(options.transform));
    }

    public activate() {
        if (!super.activate()) return;
        this.applyEdgeblend();

        const cmd = PlayCommand.color(this.options.color);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    public get layer() {
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
                    .allocate(layer)
            );
    }

    public deactivate() {
        if (!super.deactivate()) return;
        return this.executor.execute(new ClearCommand(this.layer));
    }

    public getMetadata(): {} {
        return {
            color: this.options.color,
        };
    }
}