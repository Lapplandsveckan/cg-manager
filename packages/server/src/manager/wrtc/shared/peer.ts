import { RTCPeerConnection, type RTCRtpCodecParameters } from 'werift';
import { noTryAsync } from 'no-try';
import { dtlsKeys } from './dtls';

export interface PeerCodecs {
    video?: RTCRtpCodecParameters[];
    audio?: RTCRtpCodecParameters[];
}

export async function createPeerConnection(
    codecs: PeerCodecs,
    stunServer?: string | null,
): Promise<RTCPeerConnection> {
    const [, keys] = await noTryAsync(() => dtlsKeys());

    return new RTCPeerConnection({
        codecs,
        iceServers: stunServer ? [{ urls: stunServer }] : [],
        ...(keys ? { dtls: { keys } } : {}),
    });
}

/** werift defaults to Google STUN and blocks gathering up to 5s per unreachable
 *  interface; host candidates suffice for LAN use.
 *
 *  Call this once the peer has transceivers but before gathering starts
 *  (`setLocalDescription`). werift builds the ICE transports lazily, so running
 *  it on a freshly constructed peer walks an empty list and does nothing. */
export function pinHostCandidates(
    pc: RTCPeerConnection,
    stunServer?: string | null,
): void {
    if (stunServer) return;

    for (const transport of pc.dtlsTransports) {
        const connection = transport?.iceTransport?.connection;
        if (connection) connection.stunServer = undefined;
    }
}
