import {SimpleCommand} from '../command';

export class ClearCommand extends SimpleCommand {
    protected getCommandType() {
        return 'CLEAR';
    }
}