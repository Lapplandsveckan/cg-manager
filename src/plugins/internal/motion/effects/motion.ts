import {Effect} from '../../../../manager/amcp/effect';
import {EffectGroup} from '../../../../manager/amcp/layers';
import {PlayCommand} from '../../../../manager/amcp/commands/play';
import {ClearCommand} from '../../../../manager/amcp/commands/clear';
import {Command, CommandGroup} from '../../../../manager/amcp/command';
import {Logger} from '../../../../util/log';
import {MixerCommand} from '../../../../manager/amcp/commands/mixer';
import {Color} from '../../../../manager/amcp/commands/loadbg';

type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface VideoEffectOptions {
    clip: string;
    color?: string;
    disposeOnStop?: boolean;
}

export class MotionEffect extends Effect {
    protected options: VideoEffectOptions;
    protected color: string;

    public constructor(group: EffectGroup, options: VideoEffectOptions) {
        super(group);

        this.options = options;
        this.color = options.color;
        this.allocateLayers(2);
    }

    public setColor(color: string) {
        if (!this.active) return;
        if (!this.colorLayer) return;
        if (this.color === color) return;

        // TODO: handle transition

        const cmds: Command[] = [];
        if (!this.color) {
            const mixerCmd = MixerCommand
                .create()
                .keyer(1)
                .brightness(2)
                .saturation(0)
                .allocate(this.videoLayer);

            cmds.push(mixerCmd);
        } else if (!color) {
            const mixerCmd = MixerCommand
                .create()
                .keyer(0)
                .brightness(1)
                .saturation(1)
                .allocate(this.videoLayer);

            cmds.push(mixerCmd);
        }

        if (color)
            cmds.push(PlayCommand
                .color(color)
                .allocate(this.colorLayer));
        else
            cmds.push(
                new ClearCommand(this.colorLayer));

        this.color = color;

        const cmd = new CommandGroup(cmds);
        return this.executor.execute(cmd);
    }

    public get transitionDuration() {
        return 3;
    }

    public get FPS() {
        return 50; // TODO: get from config
    }

    public activate() {
        if (!super.activate()) return;

        const cmds = [
            PlayCommand
                .video(this.options.clip, { loop: true })
                .allocate(this.videoLayer),
        ];

        if (this.color) {
            const mixerCmd = MixerCommand
                .create()
                .keyer(1)
                .brightness(2)
                .saturation(0)
                .allocate(this.videoLayer);

            const colorCmd = PlayCommand
                .color(this.color)
                .allocate(this.colorLayer);

            cmds.push(mixerCmd);
            cmds.push(colorCmd);
        }

        if (this.transitionDuration > 0) {
            const videoMixCmd = MixerCommand
                .create()
                .opacity(0)
                .allocate(this.videoLayer);

            const colorMixCmd = MixerCommand
                .create()
                .opacity(0)
                .allocate(this.colorLayer);

            cmds.push(videoMixCmd);
            cmds.push(colorMixCmd);

            setTimeout(() => {
                const videoMixCmd = MixerCommand
                    .create()
                    .opacity(1, this.transitionDuration * this.FPS)
                    .allocate(this.videoLayer);

                const colorMixCmd = MixerCommand
                    .create()
                    .opacity(1, this.transitionDuration * this.FPS)
                    .allocate(this.colorLayer);

                const cmd = new CommandGroup([videoMixCmd, colorMixCmd]);
                this.executor.execute(cmd);
            }, 100);
        }

        const cmd = new CommandGroup(cmds);
        return this.executor.execute(cmd);
    }

    protected get videoLayer() {
        return this.layers[0];
    }

    protected get colorLayer() {
        return this.layers[1];
    }

    public deactivate() {
        if (!super.deactivate()) return;
        if (this.transitionDuration <= 0) return this._deactivate();

        const videoMixCmd = MixerCommand
            .create()
            .opacity(0, this.transitionDuration * this.FPS)
            .allocate(this.videoLayer);

        const colorMixCmd = MixerCommand
            .create()
            .opacity(0, this.transitionDuration * this.FPS)
            .allocate(this.colorLayer);

        setTimeout(() => this._deactivate(), this.transitionDuration * 1000);

        const cmd = new CommandGroup([videoMixCmd, colorMixCmd]);
        return this.executor.execute(cmd);
    }

    private _deactivate() {
        const cmd = new CommandGroup([new ClearCommand(this.videoLayer), new ClearCommand(this.colorLayer)]);
        const result = this.executor.execute(cmd);
        if (this.options.disposeOnStop) result.then(() => !this.active && this.dispose());

        return result;
    }

    public getMetadata(): {} {
        return {

        };
    }
}