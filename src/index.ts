import { noTryAsync } from 'no-try';
import config, { loadConfig } from './util/config';
import { Logger } from './util/log';
import { CGServer } from './api/server';
import { Discovery } from './manager/discovery';
import { CasparManager } from './manager';
import { loadPlugins, unloadPlugins } from './plugins/plugins';
import { startWeb } from './web';

Logger.debug('Debug mode enabled!');

/** Pattern-matches the CasparResponseError shape from @lappis/cg-manager
 *  without importing it directly (it's not exported from the public surface).
 *  AMCP timeouts come through with code -1 + name "CasparResponseError";
 *  protocol errors carry the AMCP 4xx/5xx code. */
function isAmcpError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const err = e as { name?: string; code?: number };
    if (err.name === 'CasparResponseError') return true;
    return (
        typeof err.code === 'number' &&
        (err.code === -1 || (err.code >= 400 && err.code < 600))
    );
}

/** Formats a caught value for logging. CasparResponseError gets a compact
 *  one-liner instead of a multiline message + full stack. */
function formatError(e: unknown): string | Error {
    if (isAmcpError(e) && typeof e === 'object' && e !== null) {
        const err = e as { name?: string; code?: number; data?: string[] };
        const msg = Array.isArray(err.data) ? err.data.join(', ') : '';
        return `${err.name ?? 'CasparResponseError'} (${err.code ?? '?'}): ${msg}`;
    }
    if (e instanceof Error) return e;
    if (typeof e === 'object') return JSON.stringify(e);
    return String(e);
}

/** AMCP errors (timeout, channel-out-of-range, 4xx/5xx response) are transient.
 *  In prod, absorb them — keeping the manager up is the priority. In dev, bounce
 *  the socket (when still up) so host state re-syncs and the dev sees it happened;
 *  disconnect-induced rejections arrive while already disconnected, so guard on
 *  `executor.connected` to avoid racing the existing retry.
 *  Returns true if `e` was an AMCP error and has been handled. */
function handleAmcpError(e: unknown): boolean {
    if (!isAmcpError(e)) return false;
    if (config.dev) {
        const { executor } = CasparManager.getManager();
        if (executor.connected) {
            Logger.warn('Unhandled AMCP error — bouncing AMCP socket.');
            executor.bounce();
        }
    }
    return true;
}

async function start() {
    if (process.env.CASPAR_DIR) process.chdir(process.env.CASPAR_DIR);

    Logger.info('Starting Caspar CG manager...');
    await loadConfig();
    startWeb();

    const manager = CasparManager.getManager();
    await manager.start();

    Logger.info('Starting incoming handler...');

    const server = new CGServer(manager, config.port);
    await server.start();

    manager.server = server;

    Logger.info('Starting discovery beacon...');

    const discovery = new Discovery();
    await discovery.start();

    Logger.info('Loading plugins...');
    await loadPlugins();

    Logger.info('Loading video routes...');
    await manager.routes.loadVideoRoutes();

    Logger.info('Gateway started!');

    return async () => {
        Logger.info('Stopping gateway...');

        await unloadPlugins();
        await discovery.stop();
        await server.stop();
        await manager.stop();

        Logger.info('Gateway stopped!');

        process.exit(0);
    };
}

export function stop() {
    if (stopHandler) stopHandler();
}

let stopHandler: () => Promise<void> | void;
async function main() {
    const [err] = await noTryAsync(async () => {
        process.on('uncaughtException', e => {
            Logger.error(formatError(e));
            if (handleAmcpError(e)) return false;
            if (config.dev) stop();
            return false;
        });

        process.on('unhandledRejection', e => {
            Logger.error(formatError(e));
            if (handleAmcpError(e)) return false;
            // Anything else: graceful shutdown in dev, log-and-continue in prod.
            if (config.dev) stop();
            return false;
        });

        process.on('exit', () => {
            Logger.info('Exiting...');
        });

        const stop = await start();
        stopHandler = stop;

        const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
        signals.forEach(signal => {
            process.on(signal, () => {
                stop();
                return false;
            });
        });
    });

    if (err) {
        Logger.error(err);
        // AMCP errors (timeout, bad response) must not take the whole manager
        // down — they're transient and the executor recovers on reconnect.
        // Anything else (config parse failure, port bind, etc.) is fatal.
        if (!isAmcpError(err)) process.exit(1);
    }
}

if (require.main === module) {
    const argv = process.argv.slice(2);
    if (argv[0] === 'plugins') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { runPluginCli } = require('./cli/plugins');
        (runPluginCli(argv.slice(1)) as Promise<void>).catch((e: unknown) => {
            console.error(e instanceof Error ? e.message : String(e));
            process.exit(1);
        });
    } else if (argv[0] === 'config') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { runConfigCli } = require('./cli/config');
        (runConfigCli(argv.slice(1)) as Promise<void>).catch((e: unknown) => {
            console.error(e instanceof Error ? e.message : String(e));
            process.exit(1);
        });
    } else {
        main();
    }
}
