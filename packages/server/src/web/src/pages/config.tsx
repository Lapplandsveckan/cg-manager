import React from 'react';
import { Box, Stack } from '@mui/material';
import { DefaultContentLayout } from '../components/DefaultContentLayout';
import { AdvancedConfig } from '../components/config/AdvancedConfig';
import { SimpleConfig } from '../components/config/simple/SimpleConfig';
import { ConfigHeader } from '../components/config/ConfigHeader';
import { ConfigStatus } from '../components/config/ConfigStatus';
import { ConsumerDialogs } from '../components/config/ConsumerDialogs';
import { SlotErrorBoundary } from '../components/SlotErrorBoundary';
import { useConfigDraft } from '../lib/config/useConfigDraft';
import { useConsumerEditor } from '../lib/config/useConsumerEditor';
import { useConfigMode } from '../lib/config/useConfigMode';

const Page = () => {
    const config = useConfigDraft();
    const consumers = useConsumerEditor(config.draft, config.updateChannel);
    const { mode, setMode } = useConfigMode();
    const goAdvanced = () => setMode('advanced');

    return (
        <DefaultContentLayout>
            <Stack spacing={3} sx={{ maxWidth: 1040 }}>
                <ConfigHeader
                    dirty={config.dirty}
                    saving={config.saving}
                    mode={mode}
                    onSave={config.save}
                    onDiscard={config.discard}
                    onModeChange={setMode}
                />

                <ConfigStatus
                    drift={config.drift}
                    error={config.error}
                    loading={!config.draft && !config.error}
                />

                {config.draft && (
                    <>
                        {mode === 'simple' ? (
                            <SlotErrorBoundary label="config:simple">
                                <SimpleConfig
                                    config={config}
                                    consumers={consumers}
                                    onGoAdvanced={goAdvanced}
                                />
                            </SlotErrorBoundary>
                        ) : (
                            <AdvancedConfig
                                config={config}
                                consumers={consumers}
                            />
                        )}

                        <Box sx={{ height: 32 }} />
                    </>
                )}
            </Stack>

            <ConsumerDialogs {...consumers} simple={mode === 'simple'} />
        </DefaultContentLayout>
    );
};

export default Page;
