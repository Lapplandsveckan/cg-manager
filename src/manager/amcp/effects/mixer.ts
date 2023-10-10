import {Effect, EffectLayer} from '../effect';

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

interface Tween {
    type: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    duration: number;
}

export class MixerEffect extends Effect {
    private commands: string[];

    constructor() {
        super();

        this.commands = [];
    }

    public keyer(keyer: number) {
        this.commands.push(`KEYER ${keyer}`);
        return this;
    }

    public chroma(chroma: Chrome, tween: Tween) {
        if (!chroma.enabled) {
            this.commands.push('CHROMA 0');
            return this;
        }

        const args = [
            'CHROMA',
            1,

            chroma.target_hue,
            chroma.hue_width,
            chroma.min_saturation,
            chroma.min_brightness,
            chroma.softness,
            chroma.spill_suppress,
            chroma.spill_suppress_saturation,
            chroma.show_mask ? 1 : 0,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public blend(blend: string) {
        const args = [
            'BLEND',
            blend,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public invert(invert: boolean) {
        this.commands.push(`INVERT ${invert ? 1 : 0}`);
        return this;
    }

    public opacity(opacity: number, tween: Tween) {
        const args = [
            'OPACITY',
            opacity,
            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public brightness(brightness: number, tween: Tween) {
        const args = [
            'BRIGHTNESS',
            brightness,
            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public saturation(saturation: number, tween: Tween) {
        const args = [
            'SATURATION',
            saturation,
            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public contrast(contrast: number, tween: Tween) {
        const args = [
            'CONTRAST',
            contrast,
            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public levels(levels: Levels, tween: Tween) {
        const args = [
            'LEVELS',

            levels.min_input,
            levels.max_input,
            levels.gamma,
            levels.min_output,
            levels.max_output,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public fill(fill: Fill, tween: Tween) {
        const args = [
            'FILL',

            fill.x,
            fill.y,
            fill.x_scale,
            fill.y_scale,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public clip(clip: Clip, tween: Tween) {
        const args = [
            'CLIP',

            clip.x,
            clip.y,
            clip.width,
            clip.height,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public anchor(anchor: Anchor, tween: Tween) {
        const args = [
            'ANCHOR',

            anchor.x,
            anchor.y,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public crop(crop: Crop, tween: Tween) {
        const args = [
            'CROP',

            crop.left_edge,
            crop.top_edge,
            crop.right_edge,
            crop.bottom_edge,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public rotation(angle: number, tween: Tween) {
        const args = [
            'ROTATION',

            angle,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public perspective(perspective: Perspective, tween: Tween) {
        const args = [
            'PERSPECTIVE',

            perspective.top_left.x,
            perspective.top_left.y,
            perspective.top_right.x,
            perspective.top_right.y,
            perspective.bottom_right.x,
            perspective.bottom_right.y,
            perspective.bottom_left.x,
            perspective.bottom_left.y,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public mipmap(mipmap: boolean) {
        this.commands.push(`MIPMAP ${mipmap ? 1 : 0}`);
        return this;
    }

    public volume(volume: number, tween: Tween) {
        const args = [
            'VOLUME',

            volume,

            tween.duration,
            tween.type,
        ];

        this.commands.push(args.join(' '));
        return this;
    }

    public mastervolume(volume: number) {
        this.commands.push(`MASTERVOLUME ${volume}`);
        return this;
    }

    public straightAlphaOutput(enabled: boolean) {
        this.commands.push(`STRAIGHT_ALPHA_OUTPUT ${enabled ? 1 : 0}`);
        return this;
    }

    private active: boolean = false;
    public getActive() {
        return this.active;
    }

    public deactivate() {
        this.commands = [];

        const position = this.getPosition();
        if (!position) return;

        this.sendCommand(`MIXER CLEAR ${position}`);
        this.active = false;
    }

    public activate() {
        const position = this.getPosition();
        if (!position) return;

        this.sendCommand(this.commands.map((command) => `MIXER ${position} ${command}`));

        this.active = true;
        this.commands = [];
    }

    public getEffectLayer(): number {
        return EffectLayer.MIXER;
    }
}