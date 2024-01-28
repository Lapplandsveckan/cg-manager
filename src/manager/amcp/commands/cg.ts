import {Command, LayeredCommand, RawCommand} from '../command';

export class CgCommand extends LayeredCommand {
    private cmd: string;
    private cgLayer?: number;
    private arguments: string[] = [];
    constructor() {
        super();
    }

    private static single(layer: number, cmd: string) {
        const command = new CgCommand();
        command.cmd = cmd;
        command.cgLayer = layer;

        return command;
    }

    public static add(layer: number, templateName: string, playOnLoad: boolean, data?: any) {
        const cmd = CgCommand.single(layer, 'ADD');

        cmd.arguments.push(templateName);
        cmd.arguments.push(playOnLoad ? '1' : '0');
        if (data) cmd.arguments.push(JSON.stringify(data));

        return cmd;
    }

    public static play(layer: number) {
        return CgCommand.single(layer, 'PLAY');
    }

    public static stop(layer: number) {
        return CgCommand.single(layer, 'STOP');
    }

    public static next(layer: number) {
        return CgCommand.single(layer, 'NEXT');
    }

    public static remove(layer: number) {
        return CgCommand.single(layer, 'REMOVE');
    }

    public static clear(layer?: number) {
        return CgCommand.single(layer, 'CLEAR');
    }

    public static update(layer: number, data: any) {
        const command = CgCommand.single(layer, 'UPDATE');
        command.arguments.push(JSON.stringify(data));

        return command;
    }

    public static invoke(layer: number, method: string) {
        const command = CgCommand.single(layer, 'INVOKE');
        command.arguments.push(method);

        return command;
    }

    public static info(layer: number) {
        return CgCommand.single(layer, 'INFO');
    }

    public getCommand() {
        const position = this.getPosition();
        if (!position) return;

        let args = this.arguments.join(' ');
        if (this.cgLayer !== undefined) args = `${this.cgLayer} ${args}`;

        return `CG ${position} ${this.cmd} ${args}`;
    }
}