import {
    Effect,
    EffectGroup,
    PlayCommand,
    StopCommand,
    Transform,
    BasicLayer, Command,
} from '@lappis/cg-manager';

type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface RouteEffectOptions {
    source: BasicLayer;
    transform?: Tuple<number, 8>;
    disposeOnStop?: boolean;
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

    public activate() {
        if (!super.activate()) return;

        const cmd = PlayCommand.route(this.options.source);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;

        const cmd = new StopCommand(this.layer);
        const result = this.executor.execute(cmd);
        if (this.options.disposeOnStop) result.then(() => !this.active && this.dispose());

        return result;
    }

    public getMetadata(): {} {
        return {};
    }

    public updatePositions(): Command[] {
        if (!this.active) return [];
        return [
            PlayCommand
                .route(this.options.source)
                .allocate(this.layer),
        ];
    }
}