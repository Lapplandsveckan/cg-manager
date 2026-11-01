import {
    ClearCommand,
    Effect,
    type EffectGroup,
    PlayCommand,
} from '@lappis/cg-manager';

export interface ScreenshareEffectOptions {
    sessionId: string;
    /** The ingest session's playable URL, resolved when the effect is created. */
    url: string;
    label?: string;
}

export class ScreenshareEffect extends Effect {
    private options: ScreenshareEffectOptions;

    public constructor(group: EffectGroup, options: ScreenshareEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers();
    }

    public activate() {
        if (!super.activate()) return;

        // No LOOP: a live stream has nothing to loop back to, and CasparCG
        // would restart the producer the moment the sender pauses.
        const cmd = PlayCommand.video(this.options.url);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;

        return this.executor.execute(new ClearCommand(this.layer));
    }

    public getName() {
        return this.options.label ?? 'Screen share';
    }

    public getMetadata() {
        return { sessionId: this.options.sessionId, url: this.options.url };
    }

    private get layer() {
        return this.layers[0];
    }
}
