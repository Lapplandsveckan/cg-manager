import {Effect} from '../../../../manager/amcp/effect';
import {EffectGroup} from '../../../../manager/amcp/layers';
import {ClearCommand} from '../../../../manager/amcp/commands/clear';
import {CgCommand} from '../../../../manager/amcp/commands';

export interface SwishEffectOptions {
    template: string;
    disposeOnStop: boolean;
}

export class SwishEffect extends Effect {
    protected options: SwishEffectOptions;

    public constructor(group: EffectGroup, options: SwishEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers(1);
    }

    public get layer() {
        return this.layers[0];
    }
    public activate() {
        if (!super.activate()) return;

        const cmd = CgCommand.add(this.options.template);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;

        const cmd = new ClearCommand(this.layer);
        const result = this.executor.execute(cmd);
        if (this.options.disposeOnStop) result.then(() => !this.active && this.dispose());

        return result;
    }

    public getMetadata(): {} {
        return {

        };
    }
}