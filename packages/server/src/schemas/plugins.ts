import { z } from 'zod';

export const statusBody = z.object({ enabled: z.boolean() });
export const versionBody = z.object({ version: z.string().min(1) });

export const pluginUploadBody = z.object({
    filename: z.string().min(1),
    chunks: z.int().positive(),
});
