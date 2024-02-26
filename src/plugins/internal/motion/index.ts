import {CasparPlugin} from '../../../manager/amcp/plugin';
import {MotionEffect, VideoEffectOptions} from './effects/motion';
import {Method, WebError} from 'rest-exchange-protocol';
import path from 'path';
import {UI_INJECTION_ZONE} from '../../../manager/amcp/ui';

export default class VideoPlugin extends CasparPlugin {
    private motion: MotionEffect;
    private color: string;

    public static get pluginName() {
        return 'motion';
    }

    protected onEnable() {
        // TODO: sanitize options input, verify that the options are valid
        const group = this.api.getEffectGroup('1:motion', 0); // TODO: not hardcode channel
        const clips = [
            'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/ALWAYS_WINTER_HD',
            'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/JOLLY_SNOW_HD',
            'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/MOONLIGHT_SNOW_STAR_HD',
            null,
        ];

        this.api.registerEffect(
            'motion',
            (group, options) => new MotionEffect(group, options as VideoEffectOptions),
        );

        this.api.registerRoute('motion', async req => {
            this.logger.info('Setting motion');
            if (!req.data) throw new WebError('Invalid request', 400);

            const { clip } = req.data as {clip: string};
            this.setMotion(clip);
        }, Method.ACTION);

        this.api.registerRoute('color', async req => {
            this.logger.info('Setting motion color');
            if (!req.data) throw new WebError('Invalid request', 400);

            const { color } = req.data as {color: string};
            this.setColor(color);
        }, Method.ACTION);

        this.api.registerUI(UI_INJECTION_ZONE.EFFECT_CREATOR, path.join(__dirname, 'ui', 'motion'));
    }

    public setMotion(clip?: string) {
        this.motion?.deactivate();
        if (!clip) return;

        this.motion = this.api.createEffect('motion', '1:motion', {
            clip,
            disposeOnStop: true,
            color: this.color,
        }) as MotionEffect;

        this.motion.activate();
    }

    public setColor(color?: string) {
        this.motion?.setColor(color);
        this.color = color;
    }
}