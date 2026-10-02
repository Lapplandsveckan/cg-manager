import { z } from 'zod';

export const uploadBody = z.object({
    path: z.string().min(1),
    chunks: z.int().positive(),
});

export const uploadCancelBody = z.object({ id: z.string().min(1) });

export const folderBody = z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
});

export const folderRenameBody = z.object({
    from: z.string(),
    to: z.string(),
});

export const mediaUpdateBody = z
    .object({
        name: z.string().optional(),
        path: z.string().optional(),
    })
    .refine(body => body.name !== undefined || body.path !== undefined, {
        message: 'Missing "name" or "path"',
    });
