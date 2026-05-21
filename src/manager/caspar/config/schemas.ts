export const schema = {
    string: () => 'string',
    number: () => 1,
    boolean: () => true,
    enum: <T>(values: readonly T[]) => values[0],
    schema: <T>(schema: T): Partial<T> => schema,

    // Array of items wrapped in `<name>...</name>` inside the parent element.
    // `_name` is stored on the outer array (not the inner item schema) so
    // primitive item schemas like `schema.number()` survive — needed for
    // `<universes><universe>0</universe><universe>1</universe></universes>`.
    array: <T>(item: T, name: string): T[] => {
        const arr: any = [item];
        arr._name = name;
        return arr;
    },
};

export const schemas = {
    decklink: schema.schema({
        device: schema.number(),
        keyDevice: schema.number(),
        embeddedAudio: schema.boolean(),
        latency: schema.enum(['normal', 'low', 'default'] as const),
        keyer: schema.enum(['external', 'external_separate_device', 'internal', 'default'] as const),
        keyOnly: schema.boolean(),
        bufferDepth: schema.number(),
        videoMode: schema.string(),
        subregion: schema.schema({
            srcX: schema.number(),
            srcY: schema.number(),
            destX: schema.number(),
            destY: schema.number(),
            width: schema.number(),
            height: schema.number(),
        }),

        waitForReference: schema.enum(['auto', 'enable', 'disable'] as const),
        waitForReferenceDuration: schema.number(),

        ports: schema.array(
            schema.schema({
                device: schema.number(),
                keyOnly: schema.boolean(),
                videoMode: schema.string(),
                subregion: schema.schema({
                    srcX: schema.number(),
                    srcY: schema.number(),
                    destX: schema.number(),
                    destY: schema.number(),
                    width: schema.number(),
                    height: schema.number(),
                }),
            }),
            'port',
        ),
    }),
    bluefish: schema.schema({
        device: schema.number(),
        embeddedAudio: schema.boolean(),
        keyer: schema.enum(['external', 'internal', 'disabled'] as const),
        internalKeyerAudioSource: schema.enum(['videooutputchannel', 'sdivideoinput'] as const),
        watchdog: schema.number(),
        uhdMode: schema.enum([0, 1, 2, 3] as const),
    }),
    'system-audio': schema.schema({
        channelLayout: schema.enum(['mono', 'stereo', 'matrix'] as const),
        latency: schema.number(),
    }),
    screen: schema.schema({
        device: schema.number(),
        aspectRatio: schema.enum(['4:3', '16:9', 'default'] as const),
        stretch: schema.enum(['fill', 'uniform', 'uniform_to_fill', 'none'] as const),
        windowed: schema.boolean(),
        keyOnly: schema.boolean(),
        vsync: schema.boolean(),
        borderless: schema.boolean(),
        interactive: schema.boolean(),
        alwaysOnTop: schema.boolean(),
        x: schema.number(),
        y: schema.number(),
        width: schema.number(),
        height: schema.number(),
        sbsKey: schema.boolean(),
        colourSpace: schema.enum(['RGB', 'datavideo-full', 'datavideo-limited'] as const),
    }),
    ndi: schema.schema({
        name: schema.string(),
        allowFields: schema.boolean(),
    }),
    ffmpeg: schema.schema({
        path: schema.string(),
        args: schema.string(),
    }),
    artnet: schema.schema({
        universes: schema.array(schema.number(), 'universe'),
        host: schema.string(),
        port: schema.number(),
        refreshRate: schema.number(),

        fixtures: schema.array(
            schema.schema({
                type: schema.enum(['DIMMER', 'RGB', 'RGBW'] as const),
                startAddress: schema.number(),
                // Format: "N" for a strip or "WxH" for a grid.
                fixtureCount: schema.string(),
                fixtureChannels: schema.number(),

                flux: schema.schema({
                    r: schema.number(),
                    g: schema.number(),
                    b: schema.number(),
                    w: schema.number(),
                }),

                left: schema.number(),
                top: schema.number(),

                width: schema.number(),
                height: schema.number(),
            }),
            'fixture',
        ),
    }),
};