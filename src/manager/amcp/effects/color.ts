import {Effect, EffectLayer} from '../effect';

export class ColorEffect extends Effect {
    private color: string;

    constructor(color: string) {
        super();

        this.color = color;
    }

    public static RGBA(r: number, g: number, b: number, a?: number): string {
        if (r > 255 || r < 0) throw new Error('r must be between 0 and 255');
        if (g > 255 || g < 0) throw new Error('g must be between 0 and 255');
        if (b > 255 || b < 0) throw new Error('b must be between 0 and 255');

        if (a !== undefined && (a > 255 || a < 0)) throw new Error('a must be between 0 and 255');

        const v = [r, g, b];
        if (a !== undefined) v.unshift(a);

        return v
            .map(v => v.toString(16).padStart(2, '0'))
            .join('');
    }

    public setColor(color: string) {
        this.color = color;
    }

    private active: boolean = false;
    public getActive() {
        return this.active;
    }

    public deactivate() {
        const position = this.getPosition();
        if (!position) return;

        this.sendCommand(`CLEAR ${position} ${this.color}`);
        this.active = false;
    }

    public activate() {
        const position = this.getPosition();
        if (!position) return;

        this.sendCommand(`PLAY ${position} ${this.color}`);
        this.active = true;
    }

    public getEffectLayer(): number {
        return EffectLayer.PRODUCER;
    }
}