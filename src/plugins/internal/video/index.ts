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
        this.api.getEffectGroup('3:color2');
        this.api.getEffectGroup('3:color1');

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

        this.api.registerRoute('tests/route', async req => {
            const color1Effect = this.api.createEffect('color', '3:color1', {
                color: 'red',
            }) as ColorEffect;

            const routeEffect = this.api.createEffect('route', '1:route', {
                source: color1Effect.layer,
            }) as RouteEffect;

            this.logger.info('Route effect created');

            await color1Effect.activate();
            await routeEffect.activate();

            this.logger.info('Effects activated');

            const color2Effect = this.api.createEffect('color', '3:color2', {
                color: 'blue',
            }) as ColorEffect;

            await color2Effect.activate();

            this.logger.info('Color2 activated');

            return {
                color1: color1Effect.toJSON(),
                color2: color2Effect.toJSON(),
                route: routeEffect.toJSON(),
            };
        }, Method.ACTION);


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

        this.api.registerUI(UI_INJECTION_ZONE.PLUGIN_PAGE, path.join(__dirname, 'ui', 'test'));
    }
}