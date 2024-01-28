import {LoadBGCommand} from './loadbg';

export class LoadCommand extends LoadBGCommand {
    protected getCommandType() {
        return 'LOAD';
    }
}