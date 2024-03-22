export const schema = {
    string: () => 'string',
    number: () => 1,
    boolean: () => true,
    array: <T>(schema: T, name: string) => [{...schema, _name: name} as T],
    enum: <T>(values: readonly T[]) => values[0],
    schema: <T>(schema: T): Partial<T> => schema,
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
        universe: schema.number(),
        host: schema.string(),
        port: schema.number(),
        refreshRate: schema.number(),

        fixtures: schema.array(
            schema.schema({
                type: schema.enum(['DIMMER', 'RGB', 'RGBW'] as const),
                startAddress: schema.number(),
                fixtureCount: schema.number(),
                fixtureChannels: schema.number(),

                x: schema.number(),
                y: schema.number(),

                width: schema.number(),
                height: schema.number(),

                rotation: schema.number(),
            }),
            'fixture',
        ),
    }),
};