import {Channel} from './layers';
import {BasicCommand, Command} from './command';

export interface CommandListener {
    command: string;

    success: (data: string[], code: number) => void;
    error: (data: string[], code: number) => void;
}

export class CommandExecutor {
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
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(' ');
            const code = parseInt(parts[0]);
            let data: string[] = [];

            if (code === 101 || code === 201 || code === 400) {
                i++;
                data.push(line[i]);
            }

            if (code === 200) {
                i++;
                while (lines[i] && i < lines.length - 1) {
                    data.push(lines[i]);
                    i++;
                }
            }

            let cmd = null;
            if (code !== 400 && code !== 500) cmd = parts[1];

            this.executeListeners(code, cmd, data);
            this.onEvent(code, cmd, data);
        }
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