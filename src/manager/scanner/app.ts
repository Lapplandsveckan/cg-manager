/* eslint-disable camelcase */

import config from './config';
import { Logger } from '../../util/log';
import express from 'express';
import cors from 'cors';
import ExpressPouchDB from 'express-pouchdb';
import PouchDB from 'pouchdb-node';
import { getId, getGDDScriptElement, extractGDDJSON } from './util';
import {noTryAsync} from 'no-try';
import { promises as fs } from 'fs';
import {MediaDoc} from './index';

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const logger = Logger.scope('Scanner');
function App(db: PouchDB.Database<MediaDoc>) {
    const app = express();

    app.use(cors());

    app.use('/db', ExpressPouchDB(PouchDB, {
        mode: 'minimumForPouchDB',
    }));

    app.get('/media', wrap(async (req, res) => {
        const { rows } = await db.allDocs({ include_docs: true });

        const blob = rows
            .filter(r => r.doc.mediainfo)
            .map(r => ({
                ...r.doc.mediainfo,
                mediaSize: r.doc.mediaSize,
                mediaTime: r.doc.mediaTime,
            }));

        res.set('content-type', 'application/json');
        res.send(blob);
    }));

    app.get('/media/info/:id', wrap(async (req, res) => {
        const { mediainfo } = await db.get(req.params.id.toUpperCase());

        res.set('content-type', 'application/json');
        res.send(mediainfo || {});
    }));

    app.get('/media/thumbnail/:id', wrap(async (req, res) => {
        const { _attachments } = await db.get(req.params.id.toUpperCase(), { attachments: true, binary: true });

        if (!_attachments['thumb.png']) 
            return res.status(404).end();

        res.set('content-type', 'image/png');
        res.send(_attachments['thumb.png'].data);
    }));

    app.get('/cls', wrap(async (req, res) => {
        const { rows } = await db.allDocs({ include_docs: true });

        const str = rows
            .map(row => row.doc.cinf || '')
            .reduce((acc, inf) => acc + inf, '');

        res.set('content-type', 'text/plain');
        res.send(`200 CLS OK\r\n${str}\r\n`);
    }));

    app.get('/tls', wrap(async (req, res) => {
        const rows = await fs.readdir(config.paths.template, { recursive: true });

        const str = rows
            .filter(x => /\.(ft|wt|ct|htm|html)$/.test(x))
            .map(x => `${getId(config.paths.template, x)}\r\n`)
            .reduce((acc, inf) => acc + inf, '');

        res.set('content-type', 'text/plain');
        res.send(`200 TLS OK\r\n${str}\r\n`);
    }));

    app.get('/templates', wrap(async (req, res) => {
        // TODO (perf) Use scanner?

        // List all files in the templates dir
        const files = await fs.readdir(config.paths.template, { recursive: true });

        // Categorize HTML templates separately,
        // because they have features that other template types do not.
        const htmlTemplates = [];
        const otherTemplates = [];
        for (const filePath of files) {
            {
                // Find HTML-based templates:
                const m = filePath.match(/\.(html|htm)$/);
                if (m) {
                    htmlTemplates.push({filePath, type: 'html'});
                    continue;
                }
            }
            {
                // Find other (eg flash) templates:
                const m = filePath.match(/\.(ft|wt|ct|swf)$/);
                if (m) {
                    otherTemplates.push({filePath, type: m[1]});
                    continue;
                }
            }
        }

        interface TemplateInfo {
            id: string;
            path: string;
            type: string;

            gdd?: any;
            error?: string;
        }

        // Extract any Graphics Data Defintions (GDD) from HTML templates.
        const htmlTemplatesInfo = await Promise.all(htmlTemplates.map(async ({filePath, type}) => {
            const info: TemplateInfo = {
                id: getId(config.paths.template, filePath),
                path: filePath,
                type,
            };

            const [error] = await noTryAsync(async () => {
                const gddScriptElement = await getGDDScriptElement(filePath);
                if (gddScriptElement) info.gdd = await extractGDDJSON(filePath, gddScriptElement);
            });

            if (error) {
                info.error = error.toString();
                logger.error(error);
            }

            return info;
        }));

        // Gather the info for all templates:
        const otherTemplatesInfo = otherTemplates.map(({filePath, type}) => {
            return {
                id: getId(config.paths.template, filePath),
                path: filePath,
                type,
            } as TemplateInfo;
        });

        const allTemplates = htmlTemplatesInfo
            .concat(otherTemplatesInfo)
            .sort((a, b) => a !== b && a > b ? 1 : -1); // Sort alphabetically

        // Create the final response string.
        const str = JSON.stringify({
            templates: allTemplates,
        });

        // Send the response.
        res.set('content-type', 'application/json');
        res.send(str);
    }));

    app.get('/fls', wrap(async (req, res) => {
        const rows = await fs.readdir(config.paths.font, { recursive: true });

        const str = rows
            .map(x => `${getId(config.paths.font, x)}\r\n`)
            .reduce((acc, inf) => acc + inf, '');

        res.set('content-type', 'text/plain');
        res.send(`200 FLS OK\r\n${str}\r\n`);
    }));

    app.get('/cinf/:id', wrap(async (req, res) => {
        const { cinf } = await db.get(req.params.id.toUpperCase());

        res.set('content-type', 'text/plain');
        res.send(`201 CINF OK\r\n${cinf}`);
    }));

    app.get('/thumbnail/generate', wrap(async (req, res) => {
        res.set('content-type', 'text/plain');
        res.send('202 THUMBNAIL GENERATE_ALL OK\r\n');
    }));

    app.get('/thumbnail/generate/:id', wrap(async (req, res) => {
        res.set('content-type', 'text/plain');
        res.send('202 THUMBNAIL GENERATE OK\r\n');
    }));

    app.get('/thumbnail', wrap(async (req, res) => {
        const { rows } = await db.allDocs({ include_docs: true });

        const str = rows
            .map(row => row.doc.tinf || '')
            .reduce((acc, inf) => acc + inf, '');

        res.set('content-type', 'text/plain');
        res.send(`200 THUMBNAIL LIST OK\r\n${str}\r\n`);
    }));

    app.get('/thumbnail/:id', wrap(async (req, res) => {
        const { _attachments } = await db.get(req.params.id.toUpperCase(), { attachments: true });

        if (!_attachments['thumb.png']) 
            return res.status(404).end();

        res.set('content-type', 'text/plain');
        res.send(`201 THUMBNAIL RETRIEVE OK\r\n${_attachments['thumb.png'].data}\r\n`);
    }));

    app.use((err, req, res, next) => {
        if (err) logger.error(err);
        if (res.headersSent) return res.destroy();

        res.statusCode = err ? err.status || err.statusCode || 500 : 500;
        res.end();
    });

    return app;
}

export default App;