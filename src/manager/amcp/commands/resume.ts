import {SimpleCommand} from '../command';

export class ResumeCommand extends SimpleCommand {
    protected getCommandType() {
        return 'RESUME';
    }
}