import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { noTry, noTryAsync } from 'no-try';
import config from '../../../util/config';
import { Logger } from '../../../util/log';
import { version as managerVersion } from '../../../util/version';

export interface SidecarEvent {
    type: string;
    id?: number;
    message?: string;
    [field: string]: unknown;
}

export interface SidecarCommand {
    type: string;
    [field: string]: unknown;
}

interface PendingRequest {
    resolve(event: SidecarEvent): void;
    reject(error: Error): void;
    timer: NodeJS.Timeout;
}

const logger = Logger.scope('Sidecar');

const BINARY = process.platform === 'win32' ? 'cg-sidecar.exe' : 'cg-sidecar';
const REPO_ROOT = path.join(__dirname, '../../../../../..');
const BUNDLED_BINARY = path.join(__dirname, '../../../sidecar', BINARY);
const EXTRACT_DIR = path.join(
    os.tmpdir(),
    'cg-manager',
    'sidecar',
    String(process.getuid?.() ?? 'shared'),
    managerVersion,
);

const REQUEST_TIMEOUT_MS = 10_000;
const KILL_GRACE_MS = 2000;
const CRASH_STABLE_MS = 60_000;
const CRASH_BACKOFF_BASE_MS = 1000;
const CRASH_BACKOFF_MAX_MS = 30_000;

const isPackaged = 'pkg' in process;

const ignoreError = () => undefined;

function fileStats(file: string) {
    const [, stats] = noTry(() => fs.statSync(file));
    return stats ?? null;
}

const modifiedAt = (file: string) => fileStats(file)?.mtimeMs ?? 0;
const newestFirst = (a: string, b: string) => modifiedAt(b) - modifiedAt(a);

function builtBinary(): string | null {
    const builds = ['debug', 'release']
        .map(profile => path.join(REPO_ROOT, 'target', profile, BINARY))
        .filter(candidate => fs.existsSync(candidate));

    return builds.sort(newestFirst)[0] ?? null;
}

function isCompleteCopy(file: string) {
    const size = fileStats(file)?.size;
    return !!size && size === fileStats(BUNDLED_BINARY)?.size;
}

// A binary inside the pkg snapshot cannot be executed, so it is copied out.
function extractBundledBinary(): string | null {
    if (!fs.existsSync(BUNDLED_BINARY)) return null;

    const extracted = path.join(EXTRACT_DIR, BINARY);
    const staging = `${extracted}.${process.pid}`;
    const [error] = noTry(() => {
        fs.mkdirSync(EXTRACT_DIR, { recursive: true });
        fs.writeFileSync(staging, fs.readFileSync(BUNDLED_BINARY));
        fs.chmodSync(staging, 0o755);
        fs.renameSync(staging, extracted);
    });
    if (!error) return extracted;

    // Windows refuses to replace an executable another manager is running.
    noTry(() => fs.rmSync(staging, { force: true }));
    if (isCompleteCopy(extracted)) return extracted;

    logger.warn(`Could not extract the sidecar binary: ${error.message}`);
    return null;
}

export const sidecarBinary = () =>
    process.env.CG_SIDECAR_PATH ||
    (isPackaged ? extractBundledBinary() : builtBinary());

const describeExit = (code: number | null, signal: string | null) =>
    `Sidecar exited with code ${code}${signal ? ` (signal ${signal})` : ''}`;

export class Sidecar extends EventEmitter {
    private child: ChildProcessWithoutNullStreams | null = null;
    private binary = '';
    private binaryModifiedAt = 0;
    private pending = new Map<number, PendingRequest>();
    private nextId = 1;
    private startedAt = 0;
    private crashes = 0;
    private retryAt = 0;
    private stopping = false;

    async request(command: SidecarCommand): Promise<SidecarEvent> {
        const child = this.runningChild();
        const id = this.nextId++;

        const reply = new Promise<SidecarEvent>((resolve, reject) => {
            const timer = setTimeout(
                () => this.fail(id, new Error('Sidecar did not answer')),
                REQUEST_TIMEOUT_MS,
            );
            this.pending.set(id, { resolve, reject, timer });
        });

        child.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
        return reply;
    }

    send(command: SidecarCommand) {
        this.runningChild().stdin.write(`${JSON.stringify(command)}\n`);
    }

    async version(): Promise<string> {
        const pong = await this.request({ type: 'ping' });
        return String(pong.version);
    }

    async stop() {
        const child = this.child;
        if (!child) return;

        this.stopping = true;
        const exited = new Promise<void>(resolve =>
            this.once('exit', () => resolve()),
        );

        child.stdin.end();
        const killTimer = setTimeout(
            () => child.kill('SIGKILL'),
            KILL_GRACE_MS,
        );

        await exited;
        clearTimeout(killTimer);
        this.stopping = false;
    }

    private runningChild() {
        if (this.child && !this.wasRebuilt()) return this.child;

        this.failAll(new Error('Sidecar restarted after a rebuild'));
        this.child?.kill();
        return this.spawnChild();
    }

    private wasRebuilt() {
        if (!config.dev) return false;

        const modified = modifiedAt(this.binary);
        const isMidBuild = modified === 0;
        return !isMidBuild && modified !== this.binaryModifiedAt;
    }

    private failAll(error: Error) {
        [...this.pending.keys()].forEach(id => this.fail(id, error));
    }

    private spawnChild() {
        if (Date.now() < this.retryAt)
            throw new Error('Sidecar is restarting after a crash');

        const binary = sidecarBinary();
        if (!binary)
            throw new Error(
                'Sidecar binary not found (run `yarn sidecar:build`)',
            );

        const child = spawn(binary, [], { stdio: 'pipe' });
        this.child = child;
        this.binary = binary;
        this.binaryModifiedAt = modifiedAt(binary);
        this.startedAt = Date.now();

        readline
            .createInterface(child.stdout)
            .on('line', line => this.receive(line));
        readline
            .createInterface(child.stderr)
            .on('line', line => logger.warn(line));

        child.stdin.on('error', ignoreError);
        child.on('error', error => this.exited(child, error.message));
        child.once('close', (code, signal) =>
            this.exited(child, describeExit(code, signal)),
        );

        return child;
    }

    private receive(line: string) {
        const [error, event] = noTry(() => JSON.parse(line) as SidecarEvent);
        if (error) return logger.warn(`Unreadable sidecar output: ${line}`);

        this.settle(event);
        this.emit('event', event);
    }

    private settle(event: SidecarEvent) {
        const request = this.pending.get(event.id);
        if (!request) return;

        if (event.type === 'error')
            return this.fail(event.id, new Error(event.message));

        this.pending.delete(event.id);
        clearTimeout(request.timer);
        request.resolve(event);
    }

    private fail(id: number, error: Error) {
        const request = this.pending.get(id);
        if (!request) return;

        this.pending.delete(id);
        clearTimeout(request.timer);
        request.reject(error);
    }

    private exited(child: ChildProcessWithoutNullStreams, reason: string) {
        if (this.child !== child) return;

        this.child = null;
        this.failAll(new Error(reason));
        this.emit('exit');
        if (this.stopping) return;

        logger.error(reason);
        this.delayRestart();
    }

    private delayRestart() {
        if (Date.now() - this.startedAt > CRASH_STABLE_MS) this.crashes = 0;

        this.crashes += 1;
        const backoff = CRASH_BACKOFF_BASE_MS * 2 ** (this.crashes - 1);
        this.retryAt = Date.now() + Math.min(backoff, CRASH_BACKOFF_MAX_MS);
    }
}

export const sidecar = new Sidecar();

export async function reportSidecar() {
    const [error, version] = await noTryAsync(() => sidecar.version());
    if (error) return logger.warn(`Sidecar unavailable: ${error.message}`);

    logger.info(`Sidecar ${version} ready`);
}
