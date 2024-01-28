export class BasicChannel {
    protected readonly casparChannel: number; // maybe this should not be readonly
    constructor(casparChannel: number) {
        this.casparChannel = casparChannel;
    }

    public getCasparChannel() {
        return this.casparChannel;
    }

    public getCommandString() {
        return this.getCasparChannel().toString();
    }
}

export class BasicLayer {
    protected channel: BasicChannel = undefined;
    protected casparLayer: number = undefined;

    constructor(channel: BasicChannel) {
        this.setChannel(channel);
    }

    public static caspar(channel: BasicLayer);
    public static caspar(channel: BasicChannel, layer?: number);
    public static caspar(channel: number, layer?: number);

    public static caspar(channel: number | BasicChannel | BasicLayer, layer?: number) {
        return BasicLayer.from(channel, layer);
    }

    public static from(channel: number | BasicChannel | BasicLayer, layer?: number) {
        if (channel instanceof BasicLayer) return channel;
        if (typeof channel === 'number') channel = new BasicChannel(channel);
        if (typeof layer !== 'number') return channel;

        const basicLayer = new BasicLayer(channel);
        basicLayer.setCasparLayer(layer);

        return basicLayer;
    }

    protected setChannel(channel: BasicChannel) {
        this.channel = channel;
        // TODO: events?
    }

    protected setCasparLayer(layer: number) {
        this.casparLayer = layer;
        // TODO: events?
    }

    public getCasparLayer() {
        return this.casparLayer;
    }

    public getCasparChannel() {
        return this.channel?.getCasparChannel();
    }

    public getCommandString() {
        const channel = this.getCasparChannel();
        const layer = this.getCasparLayer();
        if (layer === undefined || channel === undefined) return;

        return `${channel}-${layer}`;
    }
}