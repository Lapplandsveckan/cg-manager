import { z } from 'zod';

const options = z
    .record(z.string(), z.unknown())
    .nullish()
    .transform(
        value => (value ?? {}) as Record<string, string | number | boolean>,
    );

const orEmptyObject = (body: unknown) => body ?? {};

export const companionParams = z.object({
    plugin: z.string().min(1),
    id: z.string().min(1),
});

export const actionBody = z.preprocess(
    orEmptyObject,
    z.object({ options, surface: z.string().optional() }),
);

export const subscribeBody = z.object({
    instanceId: z.string().min(1),
    options,
});

export const unsubscribeBody = z.object({ instanceId: z.string().min(1) });
