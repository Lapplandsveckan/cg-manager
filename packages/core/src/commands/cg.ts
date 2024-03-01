import {Command, LayeredCommand, RawCommand} from '../command';

export class CgCommand extends LayeredCommand {
    private cmd: string;
    private cgLayer?: number;
    private arguments: string[] = [];

    constructor() {
        super();
    }

    public setLayer(layer: number) {
        this.cgLayer = layer;
        return this;
    }

    private static single(cmd: string) {
        const command = new CgCommand();
        command.cmd = cmd;

        return command;
    }

    public static add(templateName: string, playOnLoad = true, data?: any) {
        const cmd = CgCommand.single('ADD');

        cmd.arguments.push(templateName);
        cmd.arguments.push(playOnLoad ? '1' : '0');
        if (data) cmd.arguments.push(JSON.stringify(data));

        return cmd;
    }

    public static play() {
        return CgCommand.single('PLAY');
    }

    public static stop() {
        return CgCommand.single('STOP');
    }

    public static next() {
        return CgCommand.single('NEXT');
    }

    public static remove() {
        return CgCommand.single('REMOVE');
    }

    public static clear() {
        return CgCommand.single('CLEAR');
    }

    public static update(data: any) {
        const command = CgCommand.single('UPDATE');
        command.arguments.push(JSON.stringify(data));

        return command;
    }

    public static invoke(method: string) {
        const command = CgCommand.single('INVOKE');
        command.arguments.push(method);

        return command;
    }

    public static info() {
        return CgCommand.single('INFO');
    }

    public getCommandType() {
        return 'CG';
    }

    public getArguments(): string[] {
        const args = this.arguments.slice();
        if (this.cgLayer !== undefined) args.unshift(this.cgLayer.toString());
        else if (this.cmd !== 'CLEAR') args.unshift('0');

        args.unshift(this.cmd);

        const pos = this.getPosition();
        if (pos) args.unshift(pos);

        return args;
    }
}