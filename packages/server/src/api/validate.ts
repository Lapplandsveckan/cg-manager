import { z } from 'zod';
import { WebError, type Request } from 'rest-exchange-protocol';

export const idParams = z.object({ id: z.string().min(1) });

function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown) {
    const result = schema.safeParse(input);
    if (result.success) return result.data;
    throw new WebError(z.prettifyError(result.error), 400);
}

export const parseBody = <S extends z.ZodType>(schema: S, request: Request) =>
    parseOrThrow(schema, request.getData());

export const parseParams = <S extends z.ZodType>(schema: S, request: Request) =>
    parseOrThrow(schema, request.params);
