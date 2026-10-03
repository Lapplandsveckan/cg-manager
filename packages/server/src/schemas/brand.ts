import { z } from 'zod';

const optional = <T extends z.ZodType>(schema: T) =>
    schema
        .nullish()
        .catch(null)
        .transform(value => value ?? null);

const emptyBrand = { name: null, tagline: null, accent: null, home: null };

export const brandSchema = z
    .object({
        name: optional(z.string().min(1)),
        tagline: optional(
            z.union([z.string(), z.record(z.string(), z.string())]),
        ),
        accent: optional(z.string().regex(/^#[0-9a-f]{6}$/i)),
        home: optional(z.string().regex(/^\/[^/\\\s?#]\S*$/)),
    })
    .catch(emptyBrand);

export type Brand = z.infer<typeof brandSchema>;
