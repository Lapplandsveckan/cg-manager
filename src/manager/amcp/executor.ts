import {Channel} from './layers';
import {BasicCommand, Command} from './command';
import {TemplateInfo} from '../scanner/scanner';
import {TLSCommand} from './commands/tls';

export interface CommandListener {
    command: string;

    success: (data: string[], code: number) => void;
    error: (data: string[], code: number) => void;
}

export class CommandExecutor {
    protected templates: TemplateInfo[] = [];
    private lastFetch = 0;
    private fetchPromise: Promise<TemplateInfo[]> = null;

    protected fetchTemplates() {
        // TODO: optimize and better options
        if (!this.fetchPromise)
            this.fetchPromise = TLSCommand.getTemplates()
                .then(templates => {
                    this.fetchPromise = null;
                    return this.templates = templates;
                });


        return this.fetchPromise;
    }

    public async getTemplates(force = false) {
        if (force || (Date.now() - this.lastFetch > 1000 * 60 * 5)) {
            this.lastFetch = Date.now();
            await this.fetchTemplates();
        }

        return this.templates;
    }

    public resolveTemplates() {
        return this.templates;
    }

    public promise(command: string) {
        return new Promise<{ data: string[], code: number }>((resolve, reject) => {
            const listener: CommandListener = {
                command,
                success: (data, code) => resolve({data, code}),
                error: (data, code) => reject({data, code}),
            };

            this.addListener(listener);
        });
    }

    public execute(command: Command) {
        const data = command.getCommand();
        if (!data) return;

        const commands = BasicCommand.interpret(data);
        const promises = commands.map(cmd => this.promise(cmd.getCommand()));
        this.send(data);

        // Could be faulty if one of the commands fails, especially if it's a multi-command and in the middle
        return Promise.all(promises);
    }

    public channels = new Map<number, Channel>();

    public getChannel(casparChannel: number) {
        return this.channels.get(casparChannel);
    }

    public getChannels() {
        return Array.from(this.channels.values());
    }

    public allocateChannel(casparChannel: number) {
        const channel = new Channel(casparChannel, this);
        this.channels.set(casparChannel, channel);

        return channel;
    }

    public executeAllocations() {
        for (const channel of this.channels.values())
            channel.executeAllocation();
    }

    protected send(data: string) {

    }

    protected receive(data: string) {
        const lines = data.split('\r\n');
        const excess = lines.pop();

        let index = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(' ');
            const code = parseInt(parts[0]);
            const data: string[] = [];

            if (code === 101 || code === 201 || code === 400) {
                i++;
                data.push(lines[i]);
                if (i === lines.length) break;
            }

            if (code === 200) {
                i++;
                while (lines[i]) {
                    data.push(lines[i]);
                    i++;
                }

                if (i === lines.length) break;
            }

            index = i + 1;

            let cmd = null;
            if (code !== 400 && code !== 500) cmd = parts[1];

            this.executeListeners(code, cmd, data);
            this.onEvent(code, cmd, data);
        }

        return [...lines.slice(index), excess].join('\r\n');
    }

    protected listeners = [] as CommandListener[];
    protected addListener(listener: CommandListener) {
        this.listeners.push(listener);
    }

    protected removeListener(listener: CommandListener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) this.listeners.splice(index, 1);
    }

    protected executeListeners(code: number, cmd: string, data: string[]) {
        if (code < 200) return; // Ignore informational codes
        if (!cmd) return; // Ignore commands without a command (e.g. 400, 500)

        // TODO: look at specs for 400, 500 (remind me to do this)

        for (const listener of this.listeners) {
            if (listener.command !== cmd) continue;

            if (Math.floor(code / 100) === 2) listener.success(data, code);
            else listener.error(data, code);

            this.removeListener(listener);
            break;
        }
    }

    protected onEvent(code: number, cmd: string, data: string[]) {

    }
}