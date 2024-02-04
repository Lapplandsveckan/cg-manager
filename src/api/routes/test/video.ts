import {CasparManager} from '../../../manager';
import {WebError} from 'rest-exchange-protocol';
import {FileDatabase} from '../../../manager/scanner/db';
import {VideoEffect} from '../../../manager/amcp/effects/video';

export default {
    'GET': async (request) => {
        const manager = CasparManager.getManager();
        if (!manager.executor.connected) throw new WebError('Caspar CG is not connected', 400);

        const media = FileDatabase.db.allDocs()[0];
        if (!media) throw new WebError('No media found', 404);

        const channel = manager.executor.getChannel(1);
        if (!channel) throw new WebError('Channel not found', 404);

        const effectA = new VideoEffect(media.id, channel.getGroup('test'), { disposeOnStop: true });
        await effectA.activate(true);

        return { media };
    },
};