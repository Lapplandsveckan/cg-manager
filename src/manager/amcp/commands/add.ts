import {SimpleArgsCommand} from '../command';

export class AddCommand extends SimpleArgsCommand {
    protected getCommandType() {
        return 'ADD';
    }
}