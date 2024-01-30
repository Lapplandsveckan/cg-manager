import {Command, SimpleCommand} from '../command';

export class DeferCommand extends SimpleCommand {
    private cmd: string;
    private command?: Command;

    public static begin(Command?: Command) {
        const command = new DeferCommand();
        command.cmd = 'BEGIN';
        command.command = Command;

        return command;
    }

    public static commit() {
        const command = new DeferCommand();
        command.cmd = 'COMMIT';

        return command;
    }

    public static discard() {
        const command = new DeferCommand();
        command.cmd = 'DISCARD';

        return command;
    }

    public getCommand() {
        if (this.cmd === 'BEGIN') return `${this.cmd}\r\n${this.command.getCommand()}`;
        return this.cmd;
    }
}