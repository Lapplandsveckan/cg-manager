import { z } from 'zod';

const clip = (max: number) =>
    z
        .unknown()
        .transform(value =>
            typeof value === 'string' ? value.slice(0, max) : undefined,
        );

export const clientErrorBody = z.preprocess(
    body => (body && typeof body === 'object' ? body : {}),
    z.object({
        source: clip(100),
        message: clip(2000),
        stack: clip(10000),
        componentStack: clip(10000),
        url: clip(2000),
    }),
);
