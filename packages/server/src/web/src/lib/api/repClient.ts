import { REPClient } from 'rest-exchange-protocol-client';

/** The raw REP transport resolves every reply, success or failure — it
 *  never rejects the request promise. A failed request comes back as
 *  `{status, error}` instead of `{status: 200, data}`. Carries `.status`
 *  so callers can branch on the code (e.g. a 409 "folder not empty"). */
export class RequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

/** REPClient wrapper that turns a `{status >= 400}` reply into a thrown
 *  RequestError instead of leaving callers to check `.status` by hand. */
export class CheckedRepClient extends REPClient {
    public async request<T>(path: string, method: string, data: T) {
        const res = await super.request(path, method, data);
        if (res && typeof res.status === 'number' && res.status >= 400)
            throw new RequestError(res.error ?? 'Request failed', res.status);
        return res;
    }
}
