import {Command} from './command';
import {Logger} from '../../util/log';
import {CommandExecutor} from './executor';

export class LogExecutor extends CommandExecutor {
    public send(data: string) {
        Logger.scope('LGE').info(data);
        if (data === 'TLS') this.receive('200 TLS OK\r\nABC\r\nDEF\r\nGHI\r\nJKL\r\n\r\n');
    }
}