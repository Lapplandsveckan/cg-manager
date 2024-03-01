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

    protected getCommandType() {
        return 'CALL';
    }
    protected getArguments() {
        return [this.method];
    }
}