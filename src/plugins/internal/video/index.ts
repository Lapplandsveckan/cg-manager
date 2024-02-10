import {CasparPlugin} from '../../../manager/amcp/plugin';
import {VideoEffect, VideoEffectOptions} from './effects/video';
import {Method, WebError} from 'rest-exchange-protocol';

export default class VideoPlugin extends CasparPlugin {
    public static get pluginName() {
        return 'video';
    }

    protected onEnable() {
        // TODO: sanitize options input, verify that the options are valid
        this.api.registerEffect(
            'video',
            (group, options) => new VideoEffect(group, options as VideoEffectOptions),
        );

        this.api.registerRoute('effects/video', req => {
            const data = req.getData();
            if (typeof data !== 'object') throw new WebError('Invalid request data', 400);

            const {group, ...options} = data as {group: string | unknown} & VideoEffectOptions;
            if (typeof group !== 'string') throw new WebError('Invalid group', 400);

            return this.api.createEffect('video', group, options).toJSON();
        }, Method.ACTION);

        this.api.registerRoute('effects/video/:id/play', async req => {
            const effect = this.api.getEffect(req.params.id);
            if (!effect) throw new WebError('Effect not found', 404);
            if (!(effect instanceof VideoEffect)) throw new WebError('Effect is not a video effect', 400);

            await effect.play();
            return effect.toJSON();
        }, Method.ACTION);
    }
}