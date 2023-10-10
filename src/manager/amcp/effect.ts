export const EffectLayer = {
    NONE: -1,

    PRODUCER: 1,
    MIXER: 5,
} as const;

export class Effect {
    constructor() {

    }

    private static sendCommand(command: string) {
        console.log(`Sending command: ${command}`);
    }

    protected sendCommand(command: string | string[]) {
        if (typeof command === 'string') command = [command];
        const commandString = command.join('\n');
        Effect.sendCommand(commandString);
    }

    protected getPosition() {
        if (this.channel === undefined) return null;
        if (this.layer === undefined) return null;
        return `${this.channel}-${this.layer}`;
    }

    protected channel: number = undefined;
    protected layer: number = undefined;
    public allocate(channel?: number, layer?: number) {
        this.channel = channel;
        this.layer = layer;
    }

    public isActive() {
        return false;
    }

    public activate() {

    }

    public deactivate() {

    }

    // if two effects share the same effect layer the first will be deactivated, does not apply for layer -1
    public getEffectLayer(): number {
        return EffectLayer.NONE;
    }
}