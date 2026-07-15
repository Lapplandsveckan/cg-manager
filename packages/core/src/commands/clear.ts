import {RawCommand, SimpleCommand} from '../command';

export class ClearCommand extends SimpleCommand {
    protected getCommandType() {
        return 'CLEAR';
    }

    public static all() {
        return new RawCommand('CLEAR ALL');
    }
}