import { z } from 'zod';

export const shareCreateBody = z.object({
    label: z.string().min(1).max(100).optional(),
    maxSessions: z.number().int().min(1).max(50).optional(),
    allowAudio: z.boolean().optional(),
    expiresAt: z.number().int().positive().nullable().optional(),
});

export type ShareCreateBody = z.infer<typeof shareCreateBody>;
