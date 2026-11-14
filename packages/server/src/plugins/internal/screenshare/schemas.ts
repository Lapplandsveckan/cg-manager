import { z } from 'zod';

/** Same message whether the field is missing or blank — these surface to an
 *  operator firing a rundown item, not to an API client reading field paths. */
const required = (message: string) =>
    z.string({ error: message }).min(1, message);

export const destinationBody = z.object({
    effectLayer: required('No destination selected'),
    index: z.number().int().nonnegative().optional(),
    transform: z.array(z.number()).length(8).optional(),
});

export const showItemData = destinationBody.extend({
    sessionId: required('No screen share selected'),
});

/** Stopping only needs to know what to hide, so an item with no destination
 *  still gets torn down. */
export const stopItemData = showItemData.pick({ sessionId: true });

export type DestinationBody = z.infer<typeof destinationBody>;
export type ShowItemData = z.infer<typeof showItemData>;
