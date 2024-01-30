import {SimpleCommand} from '../command';
import {CommandExecutor} from '../executor';

export class TLSCommand extends SimpleCommand {
    protected getCommandType() {
        return 'TLS';
    }

    public static async getTemplates(executor: CommandExecutor) {
        const cmd = new TLSCommand();
        const results = await executor.execute(cmd);
        const data = results[0].data;
        const templates = data.map(line => line.split(' '));

        return templates;
    }
}