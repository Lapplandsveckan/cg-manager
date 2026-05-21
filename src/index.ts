import config, { loadConfig } from './util/config';
import {Logger} from './util/log';
import {CGServer} from './api/server';
import {Discovery} from './manager/discovery';
import {CasparManager} from './manager';
import {loadPlugins, unloadPlugins} from './plugins/plugins';

Logger.debug('Debug mode enabled!');

/** Pattern-matches the CasparResponseError shape from @lappis/cg-manager
 *  without importing it directly (it's not exported from the public surface).
 *  AMCP timeouts come through with code -1 + name "CasparResponseError";
 *  protocol errors carry the AMCP 4xx/5xx code. */
function isAmcpError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const err = e as {name?: string; code?: number};
    if (err.name === 'CasparResponseError') return true;
    return typeof err.code === 'number' && (err.code === -1 || (err.code >= 400 && err.code < 600));
}

async function start() {
    if (process.env.CASPAR_DIR) process.chdir(process.env.CASPAR_DIR);

    Logger.info('Starting Caspar CG manager...');
    await loadConfig();

    const manager = CasparManager.getManager();
    await manager.start();

    Logger.info('Starting incoming handler...');

    const server = new CGServer(manager, config.port);
    await server.start();

    manager.server = server;

    Logger.info('Starting bonjour discovery service...');

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
    try {
        process.on('uncaughtException', (e) => {
            Logger.error(e);
            if (config.dev) stop();
            return false;
        });

        process.on('unhandledRejection', (e) => {
            Logger.error(typeof e === 'object' ? JSON.stringify(e) : e as Error);

            // AMCP errors (timeout, channel-out-of-range, 4xx/5xx response)
            // are catchable but a lot of plugin code doesn't bother. Rather
            // than tear the manager down for those, bounce the AMCP socket
            // so host-side state re-syncs against whatever CasparCG actually
            // has. In prod we just absorb — keeping the manager up is the
            // priority. In dev we still bounce so the dev sees something
            // visibly happened.
            if (isAmcpError(e)) {
                if (config.dev) {
                    Logger.warn('Unhandled AMCP error — bouncing AMCP socket.');
                    CasparManager.getManager().executor.bounce();
                }
                return false;
            }

            // Anything else: legacy behaviour — graceful shutdown in dev,
            // best-effort log-and-continue in prod.
            if (config.dev) stop();
            return false;
        });

        process.on('exit', () => {
            Logger.info('Exiting...');
        });

        const stop = await start();
        stopHandler = stop;

        const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
        signals.forEach((signal) => {
            process.on(signal, () => {
                stop();
                return false;
            });
        });
    } catch (e) {
        Logger.error(e);
        process.exit(1);
    }
}

if (require.main === module) main();