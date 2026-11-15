import {
    ClearCommand,
    Effect,
    type EffectGeometry,
    type EffectGroup,
    type IngestApi,
    PlayCommand,
    geometryCommands,
    geometryTransform,
} from '@lappis/cg-manager';

export interface ScreenshareEffectOptions extends EffectGeometry {
    sessionId: string;
    /** The ingest session's playable URL, resolved when the effect is created. */
    url: string;
    label?: string;
}

type SessionPlayout = Pick<IngestApi, 'prepare' | 'release'>;

export class ScreenshareEffect extends Effect {
    private options: ScreenshareEffectOptions;
    private playout: SessionPlayout;
    private casparChannel: number;

    public constructor(
        group: EffectGroup,
        options: ScreenshareEffectOptions,
        playout: SessionPlayout,
    ) {
        super(group);

        this.options = options;
        this.playout = playout;
        this.casparChannel = group.channel.getCasparChannel();
        this.allocateLayers();

        const transform = geometryTransform(options);
        if (transform) this.setTransform(transform);
    }

    public activate() {
        if (!super.activate()) return;

        for (const command of geometryCommands(this.options, this.layers))
            this.executor.execute(command);

        return this.playOnceStreamMatchesChannel();
    }

    private async playOnceStreamMatchesChannel() {
        await this.playout.prepare(this.options.sessionId, this.casparChannel);
        if (!this.active) return;

        // No LOOP: a live stream has nothing to loop back to, and CasparCG
        // would restart the producer the moment the sender pauses.
        const cmd = PlayCommand.video(this.options.url);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;

        this.playout.release(this.options.sessionId);
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
