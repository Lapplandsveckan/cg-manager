import {Layer} from './layers';
import {CommandExecutor} from './executor';

export abstract class Effect {
    private _active: boolean = false;
    protected get active() {
        return this._active;
    }

    protected executor: CommandExecutor;
    protected constructor(executor?: CommandExecutor) {
        this.setExecutor(executor);
    }

    public setExecutor(executor: CommandExecutor) {
        this.executor = executor;
    }

    public abstract getLayers(): Layer[];
    public activate() {
        if (this.active) return;
        this._active = true;

        for (const layer of this.getLayers()) layer.addEffect(this);
    }

    public deactivate() {
        if (!this.active) return;
        this._active = false;

        for (const layer of this.getLayers()) layer.removeEffect(this);
    }

    public updatePositions() {

    }
}