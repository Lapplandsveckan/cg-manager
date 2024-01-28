import {Command} from './command';
import {Logger} from '../../util/log';
import {CommandExecutor} from './executor';

export class LogExecutor extends CommandExecutor {
    public execute(command: Command) {
        const result = command.getCommand();
        if (!result) return;

        Logger.scope('LGE').info(result);
    }
}