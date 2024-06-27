import config, { loadConfig } from './util/config';
import {Logger} from './util/log';
import {CGServer} from './api/server';
import {Discovery} from './manager/discovery';
import {CasparManager} from './manager';
import {loadPlugins, unloadPlugins} from './plugins/plugins';

Logger.debug('Debug mode enabled!');

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
        const stop = await start();
        stopHandler = stop;

        process.on('uncaughtException', (e) => {
            Logger.error(e);
            if (config.dev) stop();
            return false;
        });

        process.on('unhandledRejection', (e) => {
            Logger.error(typeof e === 'object' ? JSON.stringify(e) : e as Error);
            if (config.dev) stop();
            return false;
        });

        process.on('exit', () => {
            Logger.info('Exiting...');
        });

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