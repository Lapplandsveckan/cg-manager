import {SimpleCommand} from '../command';

export class PauseCommand extends SimpleCommand {
    protected getCommandType() {
        return 'PAUSE';
    }
}