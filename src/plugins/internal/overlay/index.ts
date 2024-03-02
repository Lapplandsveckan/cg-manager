import {Method} from 'rest-exchange-protocol';
import path from 'path';
import {SwishEffect, SwishEffectOptions} from './effects/swish';
import {CasparPlugin, UI_INJECTION_ZONE} from '@lappis/cg-manager';

export default class VideoPlugin extends CasparPlugin {
    private effect: SwishEffect;
    private swishState = -1;
    private templateRoot: string;

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

        this.api.registerFile('template', path.join(__dirname, 'templates'))
            .then(template => this.templateRoot = template.identifier)
            .then(() => this.initialize());

        this.api.registerRoute('swish', async req => {
            this.toggleSwish();
        }, Method.ACTION);

        this.api.registerUI(UI_INJECTION_ZONE.EFFECT_CREATOR, path.join(__dirname, 'ui', 'overlay'));
    }

    protected onDisable() {
        if (this.effect) {
            this.effect.dispose();
            this.effect = null;
        }
    }

    private initialize() {
        const template = `${this.templateRoot}/SWISH/INDEX`;
        this.effect = this.api.createEffect('swish', '1:overlay', {
            template,
            number: '070 797 78 20',
        }) as SwishEffect;
    }

    private toggleSwish() {
        this.swishState = (this.swishState + 1) % 3;

        switch (this.swishState) {
            case 0:
                this.effect.activate().catch(err => {
                    this.effect = null;
                    this.logger.error('Failed to activate swish effect');
                    this.logger.error(err);
                });
                break;
            case 1:
                this.effect.minimize().catch(err => {
                    this.effect = null;
                    this.logger.error('Failed to minimize swish effect');
                    this.logger.error(err);
                });
                break;
            case 2:
                this.effect.deactivate().catch(err => {
                    this.effect = null;
                    this.logger.error('Failed to deactivate swish effect');
                    this.logger.error(err);
                });
                break;
        }
    }
}