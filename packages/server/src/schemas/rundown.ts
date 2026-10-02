import { z } from 'zod';

export const rundownItemSchema = z.looseObject({
    id: z.string().min(1),
    title: z.string(),
    type: z.string().min(1),
    data: z.any(),
    metadata: z
        .looseObject({
            autoNext: z.boolean().default(false),
            color: z.string().optional(),
        })
        .default({ autoNext: false }),
});

export const rundownSchema = z.object({
    id: z.string(),
    name: z.string(),
    items: z.array(rundownItemSchema),
    type: z.enum(['rundown', 'quick']).optional(),
    createdAt: z.number().optional(),
});

export const entryCreateBody = z.union([
    z.object({
        entry: rundownItemSchema,
        index: z.number().optional(),
    }),
    rundownItemSchema.transform(entry => ({
        entry,
        index: undefined as number | undefined,
    })),
]);

export const entryUpdateBody = z.union([
    rundownItemSchema,
    z.array(rundownItemSchema),
]);

export const entryDeleteBody = z.string().min(1);
export const nameBody = z
    .string()
    .refine(name => name.trim().length > 0, { message: 'Name is required' });
export const orderBody = z.array(z.string());
export const executeBody = z.object({ entry: rundownItemSchema });

export const matchBody = z.object({
    name: z.string().min(1),
    type: z.string(),
    size: z.number().nonnegative(),
});

export const matchMediaBody = z.object({
    mediaId: z.string().min(1),
    name: z.string().min(1),
    type: z.string(),
});
