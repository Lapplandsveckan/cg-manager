import {CasparPlugin} from '../../../manager/amcp/plugin';
import {Method, WebError} from 'rest-exchange-protocol';
import path from 'path';
import {UI_INJECTION_ZONE} from '../../../manager/amcp/ui';
import {SwishEffect, SwishEffectOptions} from './effects/swish';

export default class VideoPlugin extends CasparPlugin {
    private effect: SwishEffect;

    public static get pluginName() {
        return 'overlay';
    }

    protected onEnable() {
        // TODO: sanitize options input, verify that the options are valid
        this.api.getEffectGroup('1:overlay'); // TODO: not hardcode channel

        this.api.registerEffect(
            'swish',
            (group, options) => new SwishEffect(group, options as SwishEffectOptions),
        );

        let swishTemplate: string;
        this.api.registerFile('template', path.join(__dirname, 'templates', 'swish.html'))
            .then(template => swishTemplate = template.identifier);

        this.api.registerRoute('swish', async req => {
            this.toggleSwish(swishTemplate);
        }, Method.ACTION);

        this.api.registerUI(UI_INJECTION_ZONE.EFFECT_CREATOR, path.join(__dirname, 'ui', 'overlay'));
    }

    private toggleSwish(template: string) {
        if (this.effect) {
            this.effect.deactivate();
            this.effect = null;
            return;
        }

        this.effect = this.api.createEffect('swish', '1:overlay', {
            template,
            disposeOnStop: true,
        }) as SwishEffect;

        this.effect.activate().catch(err => {
            this.effect = null;
            this.logger.error('Failed to activate swish effect');
            this.logger.error(err);
        });
    }
}