import {VideoEffect, VideoEffectOptions} from './effects/video';
import {Method, WebError} from 'rest-exchange-protocol';
import path from 'path';
import {CasparPlugin, UI_INJECTION_ZONE} from '@lappis/cg-manager';
import {RouteEffect, RouteEffectOptions} from './effects/route';
import {ColorEffect, ColorEffectOptions} from './effects/color';

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

        this.api.registerEffect(
            'route',
            (group, options) => new RouteEffect(group, options as RouteEffectOptions),
        );

        this.api.registerEffect(
            'color',
            (group, options) => new ColorEffect(group, options as ColorEffectOptions),
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

        this.api.registerUI(UI_INJECTION_ZONE.PLUGIN_PAGE, path.join(__dirname, 'ui', 'test'));
    }
}