import {BasicChannel, BasicLayer} from './basic';

export abstract class Command {
    public abstract getCommand(): string | undefined | void;
}

export abstract class LayeredCommand extends Command {
    protected allocation?: BasicLayer | BasicChannel;

    constructor(allocation?: BasicLayer | BasicChannel) {
        super();
        if (allocation) this.allocate(allocation);
    }

    public allocate(channel: BasicLayer | BasicChannel | number);
    public allocate(channel: BasicChannel | number, layer: number);

    public allocate(arg1: BasicLayer | BasicChannel | number, arg2?: number) {
        this.allocation = BasicLayer.from(arg1, arg2);
        return this;
    }

    protected isChannel() {
        return this.allocation instanceof BasicChannel;
    }

    protected isLayer() {
        return this.allocation instanceof BasicLayer;
    }

    protected getPosition() {
        return this.allocation.getCommandString();
    }
}

export class SimpleCommand extends LayeredCommand {
    protected getCommandType(): string {
        return '';
    }

    public getCommand() {
        const position = this.getPosition();
        if (!position) return;

        return `${this.getCommandType()} ${position}`;
    }
}

export class SimpleArgsCommand extends SimpleCommand {
    private args: string[];

    constructor(...args: string[]) {
        super();
        this.args = args;
    }

    public setArgs(...args: string[]) {
        this.args = args;
        return this;
    }

    public getCommand() {
        const command = super.getCommand();
        if (!command) return;

        return `${command} ${this.args.join(' ')}`;
    }
}

export class CommandGroup extends LayeredCommand {
    private readonly commands: Command[];
    constructor(commands: Command[]) {
        super();
        this.commands = commands;
    }

    public allocate(arg1: BasicLayer | BasicChannel | number, arg2?: number) {
        // @ts-ignore
        super.allocate(arg1, arg2);

        for (let i = 0; i < this.commands.length; i++) {
            const command = this.commands[i];
            if (command instanceof LayeredCommand) command.allocate(this.allocation);
        }

        return this;
    }

    public getCommand(): string {
        return this.commands.map(command => command.getCommand()).join('\n');
    }
}

export class RawCommand extends Command {
    private readonly command: string;
    constructor(command: string) {
        super();
        this.command = command;
    }

    public getCommand(): string {
        return this.command;
    }
}