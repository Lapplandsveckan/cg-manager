import {Channel} from './layers';
import {BasicCommand, Command} from './command';
import {Effect} from './effect';

export interface TemplateInfo {
    id: string;
    path: string;
    type: string;

    gdd?: any;
    error?: string;
}

export interface CommandListener {
    command: string;
    timeout?: NodeJS.Timeout;

    success: (data: string[], code: number) => void;
    error: (data: string[], code: number) => void;
}

class CasparResponseError extends Error {
    public data: string[];
    public code: number;

    constructor(data: string[], code: number) {
        super([code, ...data].join('\n'));
        this.data = data;
        this.code = code;

        this.name = 'CasparResponseError';
    }
}

export class CommandExecutor {
    protected templates: TemplateInfo[] = [];

    private lastFetch = 0;
    private fetchPromise: Promise<TemplateInfo[]> = null;

    // Stamped by the subclass in handleConnect() so that promise() can give
    // commands buffered pre-connect a full timeout window from the moment the
    // socket actually becomes live (not from when the command was enqueued).
    protected _connectedAt: number = 0;

    public get connected() {
        return true;
    }

    protected async _fetchTemplates() {
        return [];
    }

    protected fetchTemplates() {
        // TODO: optimize and better options
        if (!this.fetchPromise)
            this.fetchPromise = this._fetchTemplates()
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
        const callerStack = new Error().stack;
        return new Promise<{ data: string[], code: number }>((resolve, reject) => {
            // `timeout` is tracked both as a local closure var (for fast clear
            // inside the callbacks) and mirrored onto `listener.timeout` so that
            // clearPendingCommands() can cancel it from outside the closure.
            let timeout: NodeJS.Timeout | undefined;

            const startTimeout = () => {
                timeout = setTimeout(() => {
                    timeout = undefined;
                    listener.timeout = undefined;
                    // Re-arm while disconnected, or within the first second after
                    // connecting — commands buffered pre-connect haven't had a fair
                    // response window yet since the bytes only just reached the server.
                    if (!this.connected || (Date.now() - this._connectedAt < 1000)) return startTimeout();

                    this.removeListener(listener);
                    const err = new CasparResponseError([`Timeout: "${command}"`, callerStack ?? '(no stack)'], -1);
                    reject(err);
                }, 1000);
                listener.timeout = timeout;
            };

            const onSuccess = (data: string[], code: number) => {
                if (timeout) clearTimeout(timeout);
                resolve({data, code});
            };

            const onError = (data: string[], code: number) => {
                if (timeout) clearTimeout(timeout);
                reject(new CasparResponseError(data, code));
            };

            const listener: CommandListener = {
                command,
                success: onSuccess,
                error: onError,
            };

            startTimeout();
            this.addListener(listener);
        });
    }

    /** @description NOTE: only use this function when you are certain that the server won't respond */
    public executePassive(command: Command) {
        const data = command.getCommand();
        if (!data) return;

        this.send(data);
    }

    public execute(command: Command) {
        const data = command.getCommand();
        if (!data) return;

        // TODO: handle information from commands sent such as if the cmd was a CLEAR or SWAP,
        // which would affect critical systems of this application and should be handled accordingly
        
        const commands = BasicCommand.interpret(data);
        const promises = commands.map(cmd => this.promise(cmd.getCmd()));
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

    private readData(code: number, cmd: string, lines: string[]): number {
        const data = [];

        if (code === 101 || code === 201 || code === 400) {
            data.push(lines[0]);
            if (lines.length < 1) return -1;
        }

        if (code === 200) {
            for (let i = 0; lines[i]; i++) data.push(lines[i]);
            if (data.length === lines.length) return -1;
        }

        this.executeListeners(code, cmd, data);
        this.onEvent(code, cmd, data);

        // 200 means multiple lines and ends with one empty line which will not be in data,
        // so in that case we read one more line than data.length
        return code === 200 ? data.length + 1 : data.length;
    }

    protected receive(data: string) {
        const lines = data.split('\r\n');
        const excess = lines.pop();

        let index = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(' ');

            const code = parseInt(parts[0]);

            let cmd = null;
            if (code !== 400 && code !== 500) cmd = parts[1];

            const r = this.readData(code, cmd, lines.slice(i + 1));
            if (r < 0) break;

            i += r;
            index = i + 1;
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

    /**
     * Cancel all pending command-response listeners and reject their promises.
     * Called on disconnect so orphaned timers (from commands sent just before the
     * socket dropped) don't accumulate and fire spuriously after reconnect.
     */
    protected clearPendingCommands(data = ['Disconnected'], code = -1) {
        const pending = this.listeners;
        this.listeners = [];
        for (const listener of pending) {
            if (listener.timeout) clearTimeout(listener.timeout);
            listener.error(data, code);
        }
    }

    protected executeListeners(code: number, cmd: string, data: string[]) {
        if (code < 200) return; // Ignore informational codes
        if (!cmd) return; // Ignore commands without a command (e.g. 400, 500), TODO: handle these in a different way

        const success = Math.floor(code / 100) === 2;
        for (const listener of this.listeners) {
            if (listener.command !== cmd) continue;

            if (success) listener.success(data, code);
            else listener.error(data, code);

            this.removeListener(listener);
            break;
        }
    }

    protected onEvent(code: number, cmd: string, data: string[]) {

    }

    protected effects = new Map<string, Effect>();

    public getEffects() {
        return Array.from(this.effects.values());
    }

    public getEffect(effect: string) {
        return this.effects.get(effect);
    }

    public toJSON() {
        return {
            channels: this.getChannels().map(channel => channel.toJSON()),
        };
    }
}