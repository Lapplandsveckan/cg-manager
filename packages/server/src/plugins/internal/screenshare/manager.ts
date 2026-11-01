import {
    type Logger,
    type PluginAPI,
    type IngestSessionEvent,
} from '@lappis/cg-manager';
import { noTry, noTryAsync } from 'no-try';
import {
    ScreenshareEffect,
    type ScreenshareEffectOptions,
} from './effects/screenshare';
import { type ScreenshareDestination } from './types';

interface Shown {
    destination: ScreenshareDestination;
    effect: ScreenshareEffect;
}

export class ScreenshareManager {
    private shown = new Map<string, Shown>();

    public constructor(
        private api: PluginAPI,
        private logger: Logger,
    ) {}

    public shownIds(): string[] {
        return Array.from(this.shown.keys());
    }

    public async show(
        sessionId: string,
        destination: ScreenshareDestination,
    ): Promise<void> {
        const session = this.api.ingest.getSession(sessionId);
        if (!session) throw new Error(`No ingest session ${sessionId}`);

        await this.hide(sessionId);

        const group = this.api.getEffectGroup(
            destination.effectLayer,
            destination.index,
        );
        if (!group)
            throw new Error(`No effect group ${destination.effectLayer}`);

        const options: ScreenshareEffectOptions = {
            sessionId,
            url: session.url,
            label: session.label,
        };
        const effect = new ScreenshareEffect(group, options);
        this.shown.set(sessionId, { destination, effect });

        await noTryAsync(() => Promise.resolve(effect.activate()));
    }

    public async hide(sessionId: string): Promise<void> {
        const current = this.shown.get(sessionId);
        if (!current) return;

        this.shown.delete(sessionId);
        await noTryAsync(() => Promise.resolve(current.effect.deactivate()));
        noTry(() => current.effect.dispose());
    }

    /** A closed session's URL goes dead, so drop whatever it was showing. */
    public readonly onSession = (event: IngestSessionEvent) => {
        if (event.type !== 'close') return;

        this.hide(event.session.id).catch(e =>
            this.logger.warn(`Failed to hide ${event.session.id}: ${e}`),
        );
    };

    /** CasparCG forgot everything on reconnect; rebuild from what we think is shown. */
    public readonly refresh = () => {
        const entries = Array.from(this.shown.entries());
        this.shown.clear();

        for (const [sessionId, { destination, effect }] of entries) {
            noTry(() => effect.dispose());
            this.show(sessionId, destination).catch(e =>
                this.logger.warn(`Failed to restore ${sessionId}: ${e}`),
            );
        }
    };

    public disposeAll(): void {
        for (const { effect } of this.shown.values())
            noTry(() => effect.dispose());
        this.shown.clear();
    }
}
