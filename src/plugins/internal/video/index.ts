import {VideoEffect, VideoEffectOptions} from './effects/video';
import {Method, WebError} from 'rest-exchange-protocol';
import path from 'path';
import {CasparPlugin, UI_INJECTION_ZONE} from '@lappis/cg-manager';
import {noTry} from 'no-try';

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

            const {group, clip, ...options} = data as {group: string | unknown} & {clip: string} & VideoEffectOptions;
            if (typeof group !== 'string') throw new WebError('Invalid group', 400);

            const media = this.api.getFileDatabase().get(clip);
            if (!media) throw new WebError('Clip not found', 404);

            options.media = media;
            return this.api.createEffect('video', group, options).toJSON();
        }, Method.ACTION);

        this.api.registerRoute('effects/video/:id/play', async req => {
            const effect = this.api.getEffect(req.params.id);
            if (!effect) throw new WebError('Effect not found', 404);
            if (!(effect instanceof VideoEffect)) throw new WebError('Effect is not a video effect', 400);

            await effect.play();
            return effect.toJSON();
        }, Method.ACTION);

        this.api.registerFile('template', path.join(__dirname, 'templates', 'test.html'))
            .then(data => this.logger.info(`Registered file: ${data.id} (${data.identifier})`))
            .catch(err => this.logger.error(err));

        this.api.registerUI(UI_INJECTION_ZONE.EFFECT_CREATOR, path.join(__dirname, 'ui', 'test'));
    }
}