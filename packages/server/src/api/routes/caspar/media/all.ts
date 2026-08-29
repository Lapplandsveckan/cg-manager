import { type RouteExport } from '../../../route';
import { CasparManager } from '../../../../manager';
import { isInternalMediaId } from '../../../../manager/scanner/folders';

export default {
    GET: async () =>
        CasparManager.getManager()
            .getMediaScanner()
            .getDatabase()
            .allDocs()
            .filter(doc => doc?.mediainfo)
            .filter(doc => !isInternalMediaId(doc.id)),
} satisfies RouteExport;
