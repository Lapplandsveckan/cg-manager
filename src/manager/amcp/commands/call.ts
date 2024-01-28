import {LayeredCommand} from '../command';

export class CallCommand extends LayeredCommand {
    private method: string;

    constructor(method?: string) {
        super();
        this.method = method;
    }

    public static call(method: string) {
        return new CallCommand(method);
    }

    public setMethod(method: string) {
        this.method = method;
        return this;
    }

    public getCommand() {
        if (!this.method) throw new Error('Method is not set');

        const position = this.getPosition();
        if (!position) return;

        return `CALL ${position} ${this.method}`;
    }
}