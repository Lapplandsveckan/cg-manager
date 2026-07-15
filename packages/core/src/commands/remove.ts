import {SimpleArgsCommand} from '../command';

export class RemoveCommand extends SimpleArgsCommand {
    protected getCommandType() {
        return 'REMOVE';
    }
}