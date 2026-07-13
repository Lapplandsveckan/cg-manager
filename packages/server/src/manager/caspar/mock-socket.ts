import { EventEmitter } from 'events';
import { Logger } from '../../util/log';
import { type AmcpTransport } from './amcp-socket';

const log = Logger.scope('AMCP-Mock');

export class MockAmcpSocket extends EventEmitter implements AmcpTransport {
    private _ready = false;
    private _destroyed = false;

    get ready(): boolean {
        return this._ready;
    }

    connect(): void {
        if (this._destroyed) return;
        setImmediate(() => {
            if (this._destroyed) return;
            this._ready = true;
            this.emit('ready');
        });
    }

    write(data: string): void {
        if (!this._ready) return;

        const lines = data.replace(/\r/g, '').split('\n').filter(Boolean);
        for (const line of lines) {
            log.debug(`(mock) ${line}`);
            const response = mockResponse(line);
            setImmediate(() => {
                if (!this._destroyed) this.emit('data', response);
            });
        }
    }

    destroy(): void {
        this._destroyed = true;
        this._ready = false;
    }
}

function mockResponse(line: string): string {
    const verb = line.trim().split(' ')[0]?.toUpperCase() ?? '';

    switch (verb) {
        case 'VERSION':
            return `201 VERSION OK\r\n2.3.0-mock\r\n`;
        case 'INFO':
            return `200 INFO OK\r\n<channel>\r\n  <video-mode>1080p5000</video-mode>\r\n</channel>\r\n\r\n`;
        case 'CLS':
        case 'TLS':
        case 'CINF':
        case 'DATA':
            return `200 ${verb} OK\r\n\r\n`;
        default:
            return `202 ${verb} OK\r\n`;
    }
}
