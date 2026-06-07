import { CasparPlugin } from '@lappis/cg-manager';
import { VideoEffect, type VideoEffectOptions } from './effects/video';
import { RouteEffect, type RouteEffectOptions } from './effects/route';
import { ColorEffect, type ColorEffectOptions } from './effects/color';
import { DecklinkEffect, type DecklinkEffectOptions } from './effects/decklink';

export default class VideoRoutesPlugin extends CasparPlugin {
    public static get pluginName() {
        return 'routes';
    }

    protected onEnable() {
        // TODO: sanitize options input, verify that the options are valid
        this.api.registerEffect(
            'video',
            (group, options) =>
                new VideoEffect(group, options as VideoEffectOptions),
        );

        this.api.registerEffect(
            'route',
            (group, options) =>
                new RouteEffect(group, options as RouteEffectOptions),
        );

        this.api.registerEffect(
            'color',
            (group, options) =>
                new ColorEffect(group, options as ColorEffectOptions),
        );

        this.api.registerEffect(
            'decklink',
            (group, options) =>
                new DecklinkEffect(group, options as DecklinkEffectOptions),
        );
    }
}
