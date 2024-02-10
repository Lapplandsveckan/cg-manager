import {Command, CommandGroup, LayeredCommand, RawCommand} from '../command';

interface ChromaEnabled {
    enabled: true;
    target_hue: number;
    hue_width: number;
    min_saturation: number;
    min_brightness: number;
    softness: number;
    spill_suppress: number;
    spill_suppress_saturation: number;
    show_mask: boolean;
}

interface ChromaDisabled {
    enabled: false;
}

type Chrome = ChromaEnabled | ChromaDisabled;

interface Levels {
    min_input: number;
    max_input: number;
    gamma: number;
    min_output: number;
    max_output: number;
}

interface Fill {
    x: number;
    y: number;
    x_scale: number;
    y_scale: number;
}

interface Clip {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Anchor {
    x: number;
    y: number;
}

interface Crop {
    left_edge: number;
    top_edge: number;
    right_edge: number;
    bottom_edge: number;
}

interface Perspective {
    top_left: Anchor;
    top_right: Anchor;
    bottom_right: Anchor;
    bottom_left: Anchor;
}

export interface Tween {
    type: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    duration: number;
}

class MixerSingleCommand extends LayeredCommand {
    private readonly command: string;
    private readonly args: string[];

    constructor(command: string, args: string[] = []) {
        super();
        this.command = command;
        this.args = args;
    }

    public getCommandType(): string {
        return 'MIXER';
    }

    public getArguments(): string[] {
        const position = this.getPosition();
        return [position, this.command, ...this.args];
    }
}

export class MixerCommand extends CommandGroup {
    private readonly shouldClear: boolean;

    constructor(shouldClear: boolean = false) {
        super([]);
        this.shouldClear = shouldClear;
    }

    protected single(command: string, args: string[] = [], tween?: Tween) {
        if (tween) {
            args.push(tween.duration.toString());
            args.push(tween.type);
        }

        const mixer = new MixerSingleCommand(command, args);
        this.commands.push(mixer);
        return this;
    }

    public static create() {
        return new MixerCommand();
    }

    public static clear() {
        return new MixerCommand(true);
    }

    public keyer(keyer: number) {
        return this.single('KEYER', [keyer.toString()]);
    }

    public chroma(chroma: Chrome, tween?: Tween) {
        if (!chroma.enabled) return this.single('CHROMA', ['0']);

        const args = [
            1,

            chroma.target_hue,
            chroma.hue_width,
            chroma.min_saturation,
            chroma.min_brightness,
            chroma.softness,
            chroma.spill_suppress,
            chroma.spill_suppress_saturation,
            chroma.show_mask ? 1 : 0,
        ] as any[];

        return this.single('CHROMA', args.map(arg => arg.toString()), tween);
    }

    public blend(blend: string) {
        return this.single('BLEND', [blend]);
    }

    public invert(invert: boolean) {
        return this.single('INVERT', [invert ? '1' : '0']);
    }

    public opacity(opacity: number, tween?: Tween) {
        const args = [
            opacity,
        ] as any[];

        return this.single('OPACITY', args.map(arg => arg.toString()), tween);
    }

    public brightness(brightness: number, tween?: Tween) {
        const args = [
            brightness,
        ] as any[];

        return this.single('BRIGHTNESS', args.map(arg => arg.toString()), tween);
    }

    public saturation(saturation: number, tween?: Tween) {
        const args = [
            saturation,
        ] as any[];

        return this.single('SATURATION', args.map(arg => arg.toString()), tween);
    }

    public contrast(contrast: number, tween?: Tween) {
        const args = [
            contrast,
        ] as any[];

        return this.single('CONTRAST', args.map(arg => arg.toString()), tween);
    }

    public levels(levels: Levels, tween?: Tween) {
        const args = [
            levels.min_input,
            levels.max_input,
            levels.gamma,
            levels.min_output,
            levels.max_output,
        ] as any[];

        return this.single('LEVELS', args.map(arg => arg.toString()), tween);
    }

    public fill(fill: Fill, tween?: Tween) {
        const args = [
            fill.x,
            fill.y,
            fill.x_scale,
            fill.y_scale,
        ] as any[];

        return this.single('FILL', args.map(arg => arg.toString()), tween);
    }

    public clip(clip: Clip, tween?: Tween) {
        const args = [
            clip.x,
            clip.y,
            clip.width,
            clip.height,
        ] as any[];

        return this.single('CLIP', args.map(arg => arg.toString()), tween);
    }

    public anchor(anchor: Anchor, tween?: Tween) {
        const args = [
            anchor.x,
            anchor.y,
        ] as any[];

        return this.single('ANCHOR', args.map(arg => arg.toString()), tween);
    }

    public crop(crop: Crop, tween?: Tween) {
        const args = [
            crop.left_edge,
            crop.top_edge,
            crop.right_edge,
            crop.bottom_edge,
        ] as any[];

        return this.single('CROP', args.map(arg => arg.toString()), tween);
    }

    public rotation(angle: number, tween?: Tween) {
        const args = [
            angle,
        ] as any[];

        return this.single('ROTATION', args.map(arg => arg.toString()), tween);
    }

    public perspective(perspective: Perspective, tween?: Tween) {
        const args = [
            perspective.top_left.x,
            perspective.top_left.y,
            perspective.top_right.x,
            perspective.top_right.y,
            perspective.bottom_right.x,
            perspective.bottom_right.y,
            perspective.bottom_left.x,
            perspective.bottom_left.y,
        ] as any[];

        return this.single('PERSPECTIVE', args.map(arg => arg.toString()), tween);
    }

    public mipmap(mipmap: boolean) {
        return this.single('MIPMAP', [mipmap ? '1' : '0']);
    }

    public volume(volume: number, tween?: Tween) {
        const args = [
            volume,
        ] as any[];

        return this.single('VOLUME', args.map(arg => arg.toString()), tween);
    }

    public mastervolume(volume: number) {
        return this.single('MASTERVOLUME', [volume.toString()]);
    }

    public straightAlphaOutput(enabled: boolean) {
        return this.single('STRAIGHT_ALPHA_OUTPUT', [enabled ? '1' : '0']);
    }

    public clear() {
        this.commands.splice(0, this.commands.length);
        return this;
    }
}