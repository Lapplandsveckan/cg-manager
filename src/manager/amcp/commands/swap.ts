
import {Command} from '../command';
import {BasicChannel, BasicLayer} from '../basic';

export class SwapCommand extends Command {
    protected allocation1?: BasicLayer | BasicChannel;
    protected allocation2?: BasicLayer | BasicChannel;

    constructor()
    constructor(allocation1: BasicLayer | BasicChannel, allocation2: BasicLayer | BasicChannel)

    constructor(allocation1?: BasicLayer | BasicChannel, allocation2?: BasicLayer | BasicChannel) {
        super();
        if (allocation1) this.allocate1(allocation1);
        if (allocation2) this.allocate2(allocation2);
    }

    public allocate1(channel: BasicLayer | BasicChannel | number);
    public allocate1(channel: BasicChannel | number, layer: number);

    public allocate1(arg1: BasicLayer | BasicChannel | number, arg2?: number) {
        this.allocation1 = BasicLayer.from(arg1, arg2);
        return this;
    }

    public allocate2(channel: BasicLayer | BasicChannel | number);
    public allocate2(channel: BasicChannel | number, layer: number);

    public allocate2(arg1: BasicLayer | BasicChannel | number, arg2?: number) {
        this.allocation2 = BasicLayer.from(arg1, arg2);
        return this;
    }

    public getCommand() {
        const position1 = this.allocation1?.getCommandString();
        const position2 = this.allocation2?.getCommandString();
        if (!position1 || !position2) return;

        return `SWAP ${position1} ${position2}`;
    }
}