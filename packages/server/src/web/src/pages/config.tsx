import React from 'react';
import { Box, Stack } from '@mui/material';
import { DefaultContentLayout } from '../components/DefaultContentLayout';
import { HtmlEditor } from '../components/config/HtmlEditor';
import { LoggingEditor } from '../components/config/LoggingEditor';
import { VideoModesEditor } from '../components/config/VideoModesEditor';
import { ChannelsSection } from '../components/config/ChannelsSection';
import { ConfigHeader } from '../components/config/ConfigHeader';
import { ConfigStatus } from '../components/config/ConfigStatus';
import { ConsumerDialogs } from '../components/config/ConsumerDialogs';
import { SlotErrorBoundary } from '../components/SlotErrorBoundary';
import { useConfigDraft } from '../lib/config/useConfigDraft';
import { useConsumerEditor } from '../lib/config/useConsumerEditor';

const Page = () => {
    const config = useConfigDraft();
    const consumers = useConsumerEditor(config.draft, config.updateChannel);

    return (
        <DefaultContentLayout>
            <Stack spacing={3} sx={{ maxWidth: 1040 }}>
                <ConfigHeader
                    dirty={config.dirty}
                    saving={config.saving}
                    onSave={config.save}
                    onDiscard={config.discard}
                />

                <ConfigStatus
                    drift={config.drift}
                    error={config.error}
                    loading={!config.draft && !config.error}
                />

                {config.draft && (
                    <>
                        <LoggingEditor
                            logLevel={config.draft.logLevel}
                            onChange={logLevel =>
                                config.updateDraft({ logLevel })
                            }
                        />

                        <HtmlEditor
                            html={config.draft.html}
                            onChange={html => config.updateDraft({ html })}
                        />

                        <VideoModesEditor
                            modes={config.draft.videoModes}
                            onChange={videoModes =>
                                config.updateDraft({ videoModes })
                            }
                        />

                        <SlotErrorBoundary label="config:channels">
                            <ChannelsSection
                                channels={config.draft.channels}
                                videoModes={config.draft.videoModes}
                                onAdd={config.addChannel}
                                onChange={config.updateChannel}
                                onDelete={config.deleteChannel}
                                onEditConsumer={consumers.editConsumer}
                                onAddConsumer={consumers.startPicking}
                                onDeleteConsumer={consumers.deleteConsumerAt}
                            />
                        </SlotErrorBoundary>

                        <Box sx={{ height: 32 }} />
                    </>
                )}
            </Stack>

            <ConsumerDialogs {...consumers} />
        </DefaultContentLayout>
    );
};

export default Page;
