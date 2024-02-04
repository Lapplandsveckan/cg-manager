import {BasicCommand, Command} from './command';
import {Logger} from '../../util/log';
import {CommandExecutor} from './executor';

export class LogExecutor extends CommandExecutor {
    public send(data: string) {
        Logger.scope('LGE').info(data);

        const cmds = BasicCommand.interpret(data);
        for (const cmd of cmds) this.receive(`202 ${cmd.getCmd()} OK\r\n`);
    }
}