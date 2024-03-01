import {Effect} from '../../../../manager/amcp/effect';
import {EffectGroup} from '../../../../manager/amcp/layers';
import {CgCommand} from '../../../../manager/amcp/commands';
import {Logger} from '../../../../util/log';

export interface SwishEffectOptions {
    template: string;
    number: string;
}

export class SwishEffect extends Effect {
    private options: SwishEffectOptions;

    public constructor(group: EffectGroup, options: SwishEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers(1);
        this.executor.executeAllocations();

        const cmd = CgCommand.add(this.options.template, false, { number: this.options.number });
        cmd.allocate(this.layer);

        this.executor.execute(cmd)
            .catch(err => Logger.error(`Failed to add swish effect: ${JSON.stringify(err)}`));
    }

    public get layer() {
        return this.layers[0];
    }
    public activate() {
        if (!super.activate()) return;
        return this.executor.execute(
            CgCommand
                .play()
                .allocate(this.layer),
        );
    }

    public minimize() {
        return this.executor.execute(
            CgCommand
                .next()
                .allocate(this.layer),
        );
    }

    public deactivate() {
        if (!super.deactivate()) return;
        return this.executor.execute(
            CgCommand
                .stop()
                .allocate(this.layer),
        );
    }

    public getMetadata(): {} {
        return {

        };
    }
}