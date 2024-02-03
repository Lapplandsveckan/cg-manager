import {Effect} from '../effect';
import {Layer} from '../layers';
import {CommandExecutor} from '../executor';
import {LoadBGCommand, PlayoutOptions} from '../commands/loadbg';
import {PlayCommand} from '../commands/play';
import {ClearCommand} from '../commands/clear';
import {PauseCommand} from '../commands/pause';
import {ResumeCommand} from '../commands/resume';
import {StopCommand} from '../commands/stop';
import {Command} from '../command';

export interface VideoEffectOptions {
    layer: Layer;
    clip: string;

    options?: PlayoutOptions;
}

export class VideoEffect extends Effect {
    protected options: VideoEffectOptions;
    public constructor(options: VideoEffectOptions, executor?: CommandExecutor) {
        super(executor);
        this.options = options;
    }

    getLayers(): Layer[] {
        return [this.options.layer];
    }

    protected playing: boolean = false;
    protected paused: boolean = false;
    public activate(play: boolean = true) {
        super.activate();
        if (play) this.playing = true;

        let commandType = LoadBGCommand;
        if (play) commandType = PlayCommand;

        const cmd = commandType.video(this.options.clip, this.options.options);
        cmd.allocate(this.options.layer);

        return this.executor.execute(cmd);
    }

    public play() {
        if (!this.active) return this.activate(true);
        if (this.playing) return;
        this.playing = true;

        const cmd = PlayCommand.video(this.options.clip);
        cmd.allocate(this.options.layer);

        return this.executor.execute(cmd);
    }

    public pause() {
        if (!this.active) return;
        if (!this.playing) return;
        this.playing = false;
        this.paused = true;

        const cmd = new PauseCommand(this.options.layer);
        return this.executor.execute(cmd);
    }

    public resume() {
        if (!this.active) return;
        if (!this.paused) return;
        this.playing = true;
        this.paused = false;

        const cmd = new ResumeCommand(this.options.layer);
        return this.executor.execute(cmd);
    }

    public deactivate() {
        super.deactivate();
        this.playing = false;

        let cmd: Command = new ClearCommand(this.options.layer);
        if (this.playing) cmd = new StopCommand(this.options.layer);
        // TODO: do we want this ^^^?

        return this.executor.execute(cmd);
    }
}