import {WebError} from 'rest-exchange-protocol';
import {CasparManager} from '../../../../manager';

export default {
    'ACTION': async (request) => {
        const data = request.getData();
        if (typeof data !== 'object' || data === null) throw new WebError('Invalid request data', 400);

        const {name, type, size} = data as {name?: unknown; type?: unknown; size?: unknown};
        if (typeof name !== 'string' || !name) throw new WebError('Invalid name', 400);
        if (typeof type !== 'string') throw new WebError('Invalid type', 400);
        if (typeof size !== 'number' || !Number.isFinite(size) || size < 0)
            throw new WebError('Invalid size', 400);

        return CasparManager
            .getManager()
            .rundowns.executor
            .matchFile({name, type, size});
    },
};
