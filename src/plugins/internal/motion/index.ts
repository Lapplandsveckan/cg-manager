import {CasparPlugin} from '../../../manager/amcp/plugin';
import {MotionEffect, VideoEffectOptions} from './effects/motion';
import {Method, WebError} from 'rest-exchange-protocol';
import path from 'path';
import {UI_INJECTION_ZONE} from '../../../manager/amcp/ui';

export default class VideoPlugin extends CasparPlugin {
    private motion: MotionEffect;

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

        let ci = 0;

        this.api.registerEffect(
            'motion',
            (group, options) => new MotionEffect(group, options as VideoEffectOptions),
        );

        this.api.registerRoute('toggle', async req => {
            this.logger.info('Toggling motion effect');

            const clip = clips[ci % clips.length];
            this.setMotion(clip);

            ci++;
        }, Method.ACTION);

        this.api.registerUI(UI_INJECTION_ZONE.EFFECT_CREATOR, path.join(__dirname, 'ui', 'test'));
    }

    public setMotion(clip: string) {
        this.motion?.deactivate();
        if (!clip) return;

        this.motion = this.api.createEffect('motion', '1:motion', {
            clip,
            disposeOnStop: true,
        }) as MotionEffect;

        this.motion.activate();
    }

    public setColor() {

    }
}