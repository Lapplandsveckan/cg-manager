import {SimpleCommand} from '../command';

export class StopCommand extends SimpleCommand {
    protected getCommandType() {
        return 'STOP';
    }
}