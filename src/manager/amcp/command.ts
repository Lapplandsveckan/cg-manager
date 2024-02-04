import {BasicChannel, BasicLayer} from './basic';

export abstract class Command {
    public abstract getCommand(): string | undefined | void;
}

export abstract class BasicCommand {
    protected abstract getCommandType(): string;
    protected abstract getArguments(): string[];

    public static create(command: string, ...args: string[]) {
        return new class extends BasicCommand {
            protected getCommandType() {
                return command;
            }

            protected getArguments() {
                return args;
            }

            public getCmd() {
                return this.getCommandType();
            }

            public getArgs() {
                return this.getArguments();
            }
        };
    }

    public static from(command: string) {
        if (command.endsWith('\r\n')) command = command.slice(0, -2);
        if (command.indexOf('\r\n') > -1) throw new Error('Command cannot contain line breaks');

        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        let quote = -1;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (quote < 0 && arg.startsWith('"')) quote = i;

            if (quote > -1) {
                if (!arg.endsWith('"')) continue;

                let shadowed = false;
                for (let j = arg.length - 2; j >= 0; j--) {
                    if (arg[j] !== '\\') break;
                    shadowed = !shadowed;
                }

                if (shadowed) continue;

                const a = [];
                for (let j = quote; j <= i; j++) a.push(args[j]);

                args.splice(quote, i - quote + 1, JSON.parse(a.join(' ')));
                quote = -1;
            }
        }

        if (quote > -1) throw new Error('Command contains unclosed quotes');
        return this.create(cmd, ...args);
    }

    public static interpret(command: string) {
        return command
            .split('\r\n')
            .filter(line => line.length > 0)
            .map(line => this.from(line));
    }

    protected compileArgs() {
        return this
            .getArguments()
            .map(v => v.startsWith('"') ? (v.indexOf(' ') > -1 ? v : `"${v}"`) : JSON.stringify(v))
            .map(v => v.indexOf(' ') > -1 ? v : v.substring(1, v.length - 1))
            .join(' ');
    }

    public getCommand() {
        const cmd = this.getCommandType();
        if (!cmd) return;

        const args = this.compileArgs();
        if (!args) return `${cmd}\r\n`;

        return `${cmd} ${args}\r\n`;
    }
}

export abstract class LayeredCommand extends BasicCommand {
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
        return this.allocation?.getCommandString();
    }
}

export abstract class SimpleCommand extends LayeredCommand {
    protected getArguments(): string[] {
        const position = this.getPosition();
        if (!position) return [];

        return [position];
    }
}

export abstract class SimpleArgsCommand extends SimpleCommand {
    protected args: string[];

    constructor(...args: string[]) {
        super();
        this.args = args;
    }

    public setArgs(...args: string[]) {
        this.args = args;
        return this;
    }

    protected getArguments() {
        return [...super.getArguments(), ...this.args];
    }
}

export class CommandGroup extends Command {
    protected readonly commands: Command[];
    protected allocation?: BasicLayer | BasicChannel;

    constructor(commands: Command[]) {
        super();
        this.commands = commands;
    }

    public allocate(channel: BasicLayer | BasicChannel | number);
    public allocate(channel: BasicChannel | number, layer: number);
    public allocate(arg1: BasicLayer | BasicChannel | number, arg2?: number) {
        this.allocation = BasicLayer.from(arg1, arg2);

        for (const command of this.commands)
            if (command instanceof LayeredCommand) command.allocate(this.allocation);

        return this;
    }

    public getCommand(): string {
        return this.commands.map(command => command.getCommand()).join('');
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