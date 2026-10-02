import { z } from 'zod';

export const casparConfigBody = z.looseObject({
    version: z.string(),
    videoModes: z.array(z.unknown()),
    channels: z.array(
        z.looseObject({
            videoMode: z.string(),
            consumers: z.array(z.unknown()),
        }),
    ),
});
