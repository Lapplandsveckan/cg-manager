import {SimpleCommand} from '../command';

export class PrintCommand extends SimpleCommand {
    protected getCommandType() {
        return 'PRINT';
    }
}