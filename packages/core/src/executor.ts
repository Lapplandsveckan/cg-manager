import { Channel } from './layers';
import { BasicCommand, type Command } from './command';
import { type Effect } from './effect';

const COMMAND_TIMEOUT_MS = 1000;
const CONNECT_GRACE_MS = 1000;

export interface TemplateInfo {
    id: string;
    path: string;
    type: string;

    // Arbitrary GDD JSON-schema object read off the template file; narrowing
    // to `unknown` would break consumers doing `info.gdd.foo`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Stamped by the subclass on connect; used to grant pre-connect-buffered commands a fair response window.
    protected _connectedAt: number = 0;

    public get connected() {
        return true;
    }

    protected async _fetchTemplates() {
        return [];
    }

    protected fetchTemplates() {
        if (!this.fetchPromise)
            this.fetchPromise = this._fetchTemplates().then(templates => {
                this.fetchPromise = null;
                return (this.templates = templates);
            });

        return this.fetchPromise;
    }

    public async getTemplates(force = false) {
        if (force || Date.now() - this.lastFetch > 1000 * 60 * 5) {
            this.lastFetch = Date.now();
            await this.fetchTemplates();
        }

        return this.templates;
    }

    public resolveTemplates() {
        return this.templates;
    }

    // Pre-connect-buffered commands only just reached the server, so the timeout re-arms.
    private get awaitingServer() {
        return (
            !this.connected || Date.now() - this._connectedAt < CONNECT_GRACE_MS
        );
    }

    public promise(command: string) {
        const callerStack = new Error().stack; // kept for timeout diagnostics
        const timeoutError = () =>
            new CasparResponseError(
                [`Timeout: "${command}"`, callerStack ?? '(no stack)'],
                -1,
            );

        return new Promise<{ data: string[]; code: number }>(
            (resolve, reject) => {
                const onTimeout = () => {
                    listener.timeout = undefined;
                    if (this.awaitingServer) return startTimeout();

                    this.removeListener(listener);
                    reject(timeoutError());
                };
                const startTimeout = () => {
                    listener.timeout = setTimeout(
                        onTimeout,
                        COMMAND_TIMEOUT_MS,
                    );
                };

                const clear = () => {
                    if (listener.timeout) clearTimeout(listener.timeout);
                };
                const onSuccess = (data: string[], code: number) => {
                    clear();
                    resolve({ data, code });
                };
                const onError = (data: string[], code: number) => {
                    clear();
                    reject(new CasparResponseError(data, code));
                };

                const listener: CommandListener = {
                    command,
                    success: onSuccess,
                    error: onError,
                };
                startTimeout();
                this.addListener(listener);
            },
        );
    }

    /** Only for commands the server will not answer; a reply is left unconsumed. */
    public executePassive(command: Command) {
        const data = command.getCommand();
        if (!data) return;

        this.send(data);
    }

    public execute(command: Command) {
        const data = command.getCommand();
        if (!data) return;

        const commands = BasicCommand.interpret(data);
        const promises = commands.map(cmd => this.promise(cmd.getCmd()));
        this.send(data);

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

    protected send(_data: string) {}

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

        // 200 ends with an empty line that is not in data, so read one more line.
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

    /** Cancel pending listeners and reject their promises; call on disconnect to avoid orphaned timers. */
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
        if (!cmd) return; // Ignore commands without a command (e.g. 400, 500)

        const success = Math.floor(code / 100) === 2;
        for (const listener of this.listeners) {
            if (listener.command !== cmd) continue;

            if (success) listener.success(data, code);
            else listener.error(data, code);

            this.removeListener(listener);
            break;
        }
    }

    protected onEvent(_code: number, _cmd: string, _data: string[]) {}

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
