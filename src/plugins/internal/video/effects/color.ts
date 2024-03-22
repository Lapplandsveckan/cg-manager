import {
    ClearCommand,
    Effect,
    EffectGroup,
    PlayCommand,
    Transform,
    PlayoutOptions,
} from '@lappis/cg-manager';


type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface ColorEffectOptions extends PlayoutOptions {
    color: string;
    disposeOnStop?: boolean;
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

        const cmd = PlayCommand.color(this.options.color);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    public get layer() {
        return this.layers[0];
    }

    public deactivate() {
        if (!super.deactivate()) return;

        const result = this.executor.execute(new ClearCommand(this.layer));
        if (this.options.disposeOnStop) result.then(() => !this.active && this.dispose());

        return result;
    }

    public getMetadata(): {} {
        return {
            color: this.options.color,
        };
    }
}