/* eslint-disable camelcase */

import config from './config';
import { Logger } from '../../util/log';
import express from 'express';
import cors from 'cors';
import { getId, getGDDScriptElement, extractGDDJSON } from './util';
import {noTryAsync} from 'no-try';
import { promises as fs } from 'fs';
import {FileDatabase} from './db';
import {getTemplates, getTemplatesWithContent} from './scanner';

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const logger = Logger.scope('Scanner');
function App(db: FileDatabase) {
    const app = express();

    app.use(cors());

    app.get('/media', wrap(async (req, res) => {
        const docs = db.allDocs();

        const blob = docs
            .filter(d => d.mediainfo)
            .map(d => ({
                ...d.mediainfo,
                mediaSize: d.mediaSize,
                mediaTime: d.mediaTime,
            }));

        res.set('content-type', 'application/json');
        res.send(blob);
    }));

    app.get('/media/info/:id', wrap(async (req, res) => {
        const { mediainfo } = db.get(req.params.id.toUpperCase());

        res.set('content-type', 'application/json');
        res.send(mediainfo || {});
    }));

    app.get('/media/thumbnail/:id', wrap(async (req, res) => {
        const { _attachments } = db.get(req.params.id.toUpperCase());

        if (!_attachments['thumb.png']) 
            return res.status(404).end();

        res.set('content-type', 'image/png');
        res.send(_attachments['thumb.png'].data);
    }));

    app.get('/cls', wrap(async (req, res) => {
        const docs = db.allDocs();

        const str = docs
            .map(doc => doc.cinf || '')
            .reduce((acc, inf) => acc + inf, '');

        res.set('content-type', 'text/plain');
        res.send(`200 CLS OK\r\n${str}\r\n`);
    }));

    app.get('/tls', wrap(async (req, res) => {
        const templates = await getTemplates(); // TODO (perf) Use scanner?
        const str = templates
            .map(template => template.id)
            .reduce((acc, inf) => `${acc}${inf}\r\n`, '');

        res.set('content-type', 'text/plain');
        res.send(`200 TLS OK\r\n${str}\r\n`);
    }));

    app.get('/templates', wrap(async (req, res) => {
        const templates = await getTemplatesWithContent(); // TODO (perf) Use scanner

        res.set('content-type', 'application/json');
        res.send(JSON.stringify({ templates }));
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
        const { cinf } = db.get(req.params.id.toUpperCase());

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
        const docs = db.allDocs();

        const str = docs
            .map(doc => doc.tinf || '')
            .reduce((acc, inf) => acc + inf, '');

        res.set('content-type', 'text/plain');
        res.send(`200 THUMBNAIL LIST OK\r\n${str}\r\n`);
    }));

    app.get('/thumbnail/:id', wrap(async (req, res) => {
        const doc = db.get(req.params.id.toUpperCase());
        if (!doc)
            return res.status(404).end();

        const { _attachments } = db.get(req.params.id.toUpperCase());
        if (!_attachments['thumb.png']) 
            return res.status(404).end();

        const data = _attachments['thumb.png'].data;
        const base64 = data.toString('base64');

        res.set('content-type', 'text/plain');
        res.send(`201 THUMBNAIL RETRIEVE OK\r\n${base64}\r\n`);
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