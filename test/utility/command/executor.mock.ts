import {CommandExecutor} from '../../../src/manager/amcp/executor';
import {EventEmitter} from 'events';

export class MockExecutor extends CommandExecutor {
    private events = new EventEmitter();

    protected send(data: string) {
        this.events.emit('send', data);
    }

    protected onEvent(code: number, cmd: string, data: string[]) {
        this.events.emit('event', {code, cmd, data});
    }

    public on(event: 'send', callback: (data: string) => void): this;
    public on(event: 'event', callback: (data: { code: number, cmd: string, data: string[] }) => void): this;

    public on(event: string, callback: any) {
        this.events.on(event, callback);
        return this;
    }

    public off(event: 'send', callback: (data: string) => void): this;
    public off(event: 'event', callback: (data: { code: number, cmd: string, data: string[] }) => void): this;

    public off(event: string, callback: any) {
        this.events.removeListener(event, callback);
        return this;
    }

    public buffer = '';
    public receive(data: string) {
        this.buffer += data;
        this.buffer = super.receive(this.buffer);

        return this.buffer;
    }
}