import {Layer} from './layers';
import {CommandExecutor} from './executor';

export abstract class Effect {
    protected executor: CommandExecutor;
    protected constructor(executor?: CommandExecutor) {
        this.setExecutor(executor);
    }

    public setExecutor(executor: CommandExecutor) {
        this.executor = executor;
    }

    public abstract getLayers(): Layer[];
    public activate() {
        for (const layer of this.getLayers()) layer.addEffect(this);
    }

    public deactivate() {
        for (const layer of this.getLayers()) layer.removeEffect(this);
    }

    public updatePositions() {

    }
}