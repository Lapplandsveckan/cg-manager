import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type CasparConfig, type CasparStatus } from '../api/caspar';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from './client';
import { qk } from './keys';
import { useWsBroadcast } from './useWsBroadcast';

export function useCasparStatusQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.casparStatus,
        queryFn: () => conn.caspar.getStatus(),
    });
}

export function useCasparConfigQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.casparConfig,
        queryFn: () => conn.caspar.getConfig(),
    });
}

export function useRunningConfigQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.casparRunningConfig,
        queryFn: () => conn.caspar.getRunningConfig(),
    });
}

export function useCapabilitiesQuery() {
    const conn = useSocket();
    return useQuery({
        queryKey: qk.capabilities,
        queryFn: () => conn.caspar.getCapabilities(),
    });
}

/** For the originating client after updateConfig — the `caspar/config`
 *  broadcast excludes it, so it re-baselines from the save reply itself. */
export const setCasparConfigInCache = (cfg: CasparConfig) =>
    queryClient.setQueryData(qk.casparConfig, cfg);

export interface ChannelInfo {
    channels: number[];
    videoModes: string[];
    channelSizes: Record<number, { width: number; height: number }>;
}

const EMPTY_CHANNEL_INFO: ChannelInfo = {
    channels: [],
    videoModes: [],
    channelSizes: {},
};

function deriveChannelInfo(cfg: CasparConfig): ChannelInfo {
    const channels = cfg.channels.map((_, i) => i + 1);
    const videoModes = cfg.videoModes.map(m => m.id).filter(Boolean);

    const channelSizes: ChannelInfo['channelSizes'] = {};
    cfg.channels.forEach((channel, i) => {
        const mode = cfg.videoModes.find(m => m.id === channel.videoMode);
        if (mode)
            channelSizes[i + 1] = { width: mode.width, height: mode.height };
    });

    return { channels, videoModes, channelSizes };
}

/** Channel numbers / video modes / per-channel sizes from the SAVED config —
 *  what the route editor offers as destinations. Empty while loading. */
export function useChannelInfo(): ChannelInfo {
    const { data } = useCasparConfigQuery();
    return useMemo(
        () => (data ? deriveChannelInfo(data) : EMPTY_CHANNEL_INFO),
        [data],
    );
}

/** Channel numbers CasparCG is actually serving right now — from the running
 *  snapshot, not the saved config. `null` until the first fetch resolves
 *  (avoid an empty flash), `[]` when CasparCG is off — a failed fetch counts
 *  as off so consumers degrade to their offline placeholder, not to nothing. */
export function useLiveChannels(): number[] | null {
    const { data, isError } = useRunningConfigQuery();
    return useMemo(() => {
        if (isError) return [];
        if (data === undefined) return null;
        return data ? data.channels.map((_, i) => i + 1) : [];
    }, [data, isError]);
}

/** Mounted once in QuerySync. All three payloads are full objects, so plain
 *  setQueryData (idempotent, safe on never-fetched keys). Status and
 *  running-config go to ALL clients; `caspar/config` excludes the saver,
 *  which self-patches via setCasparConfigInCache. These topics are only
 *  reachable because CasparServerApi no longer registers raw REP routes for
 *  them — REP dispatches to the first match, so don't reintroduce one there. */
export function useCasparSync(): void {
    const conn = useSocket();

    useWsBroadcast(conn, 'caspar/status', 'ACTION', data => {
        queryClient.setQueryData(qk.casparStatus, data as CasparStatus);
    });

    useWsBroadcast(conn, 'caspar/running-config', 'ACTION', data => {
        queryClient.setQueryData(
            qk.casparRunningConfig,
            (data as CasparConfig | null) ?? null,
        );
    });

    useWsBroadcast(conn, 'caspar/config', 'UPDATE', data => {
        queryClient.setQueryData(qk.casparConfig, data as CasparConfig);
    });
}
