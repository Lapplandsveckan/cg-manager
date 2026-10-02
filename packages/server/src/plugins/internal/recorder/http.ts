import path from 'path';
import { type HttpRouter } from '@lappis/cg-manager';
import { type RecordingManager } from './recordings';

export function registerDownloadRoutes(
    router: HttpRouter,
    recordings: RecordingManager,
) {
    router.get('/files/:id', (req, res) => {
        const filePath = recordings.getDownloadPath(String(req.params.id));
        if (!filePath) return res.status(404).end();

        res.download(filePath, path.basename(filePath));
    });
}
