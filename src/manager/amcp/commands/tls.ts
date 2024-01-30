import {SimpleCommand} from '../command';
import {CommandExecutor} from '../executor';
import * as https from 'https';
import {getTemplatesWithContent, TemplateInfo} from '../../scanner/scanner';

export class TLSCommand extends SimpleCommand {
    protected getCommandType() {
        return 'TLS';
    }

    public static getTemplates(): Promise<TemplateInfo[]>; // Get templates using this scanner
    public static getTemplates(url: string): Promise<TemplateInfo[]>; // Get templates using remote scanner
    public static getTemplates(executor: CommandExecutor): Promise<string[][]>; // Get templates using executor (caspar server scanner)
    public static getTemplates(arg?: CommandExecutor | string) {
        if (typeof arg === 'string') return this.getTemplatesRemote(arg);
        if (arg instanceof CommandExecutor) return this.getTemplatesExecutor(arg);
        return this.getTemplatesScanner();
    }

    private static async getTemplatesExecutor(executor?: CommandExecutor) {
        const cmd = new TLSCommand();
        const results = await executor.execute(cmd);
        const data = results[0].data;
        const templates = data.map(line => line.split(' '));

        // TODO: Parse templates

        return templates;
    }

    private static async getTemplatesRemote(url?: string) {
        return new Promise<TemplateInfo[]>((resolve, reject) => {
            https.get(url, res => {
                const data: Buffer[] = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    const string = Buffer.concat(data).toString();
                    const templates = JSON.parse(string).templates;
                    resolve(templates);
                });
            }).on('error', reject);
        });
    }

    private static getTemplatesScanner() {
        return getTemplatesWithContent();
    }
}