import { promises as fs } from 'fs';
import * as path from 'path';
import { noTryAsync } from 'no-try';
import { extractGDDJSON, getGDDScriptElement, getId } from './util';
import { Logger } from '../../util/log';
import config from './config';

const logger = Logger.scope('Templates');

export interface TemplateInfo {
    id: string;
    path: string;
    type: string;

    gdd?: any;
    error?: string;
}

export async function getTemplates() {
    const rows = await fs.readdir(config.paths.template, { recursive: true });
    return rows
        .filter(x => /\.(ft|wt|ct|swf|htm|html)$/.test(x))
        .map(x => ({
            path: path.join(config.paths.template, x),
            id: getId(config.paths.template, x),
        }));
}

export async function getTemplatesWithContent() {
    const files = await getTemplates();
    const templates = await Promise.all(
        files.map(async file => {
            const match = file.path.match(/\.(ft|wt|ct|swf)$/);
            const info: TemplateInfo = {
                ...file,
                type: match ? match[1] : 'html',
            };

            if (!match) {
                const [error] = await noTryAsync(async () => {
                    const gddScriptElement = await getGDDScriptElement(
                        file.path,
                    );
                    if (gddScriptElement)
                        info.gdd = await extractGDDJSON(
                            file.path,
                            gddScriptElement,
                        );
                });

                if (error) {
                    info.error = error.toString();
                    logger.error(error);
                }
            }

            return info as TemplateInfo;
        }),
    );

    templates.sort((a, b) => {
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
    });

    return templates;
}
