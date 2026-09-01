import React from 'react';
import { HtmlEditor } from './HtmlEditor';
import { LoggingEditor } from './LoggingEditor';
import { VideoModesEditor } from './VideoModesEditor';
import { ChannelsSection } from './ChannelsSection';
import { SlotErrorBoundary } from '../SlotErrorBoundary';
import { type useConfigDraft } from '../../lib/config/useConfigDraft';
import { type useConsumerEditor } from '../../lib/config/useConsumerEditor';

interface AdvancedConfigProps {
    config: ReturnType<typeof useConfigDraft>;
    consumers: ReturnType<typeof useConsumerEditor>;
}

export const AdvancedConfig: React.FC<AdvancedConfigProps> = ({
    config,
    consumers,
}) => {
    if (!config.draft) return null;

    return (
        <>
            <LoggingEditor
                logLevel={config.draft.logLevel}
                onChange={logLevel => config.updateDraft({ logLevel })}
            />

            <HtmlEditor
                html={config.draft.html}
                onChange={html => config.updateDraft({ html })}
            />

            <VideoModesEditor
                modes={config.draft.videoModes}
                onChange={videoModes => config.updateDraft({ videoModes })}
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
        </>
    );
};
