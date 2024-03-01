import {LoadBGCommand} from './loadbg';

export class PlayCommand extends LoadBGCommand {
    protected getCommandType() {
        return 'PLAY';
    }
}