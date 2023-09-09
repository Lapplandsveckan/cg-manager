import { Logger } from '../../util/log';
import { promises as fs } from 'fs';
import { Parser } from 'xml2js';

async function loadCasparConfig() {

    const data = await fs.readFile('/home/simme/caspar/server/casparcg_server/casparcg.config')
        .catch(() => Logger.scope('Scanner').error('Failed to read casparcg.config'));

    if (!data) return;
    Logger.info('casparcg.config read.');

    const parser = new Parser();
    parser.parseString(data, (err, result) => {
        if (err) return Logger.scope('Scanner').error('Failed to parse casparcg.config');

        for (const path in result.configuration.paths[0]) {
            const name = path.split('-')[0];
            config.paths[name] = result.configuration.paths[0][path][0];
        }
    });
}

const config = {
    paths: {
        template: './template',
        media: './media',
        font: './font',
    },
    http: {
        port: 8000,
    },
};

loadCasparConfig();

export default config;