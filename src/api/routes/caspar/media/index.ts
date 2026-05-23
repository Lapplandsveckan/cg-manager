import {CasparManager} from '../../../../manager';
import {isInternalMediaId} from '../../../../manager/scanner/folders';

export default {
    'GET': async (request) => {
        return CasparManager
            .getManager()
            .getMediaScanner()
            .getDatabase()
            .allDocs()
            // Drop anything ffprobe never managed to read. The scanner
            // skips writing these going forward, but legacy DB files
            // saved before that fix can still carry them — the filter
            // here keeps the UI sane until the file is re-scanned and
            // properly indexed (or deleted).
            .filter(doc => doc?.mediainfo)
            .map(doc => doc.id)
            // Hide plugin-side symlinks under `_internal/`. The scanner's
            // own :8000 endpoints still expose them so CasparCG can play
            // them; this filter is UI-only.
            .filter(id => !isInternalMediaId(id));
    },
};