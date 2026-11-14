import { RTCRtpCodecParameters, usePLI } from 'werift';

/** Matches ffmpeg's `-payload_type` on both the packetizing and depacketizing side. */
export const H264_PAYLOAD_TYPE = 96;

export const OPUS_PAYLOAD_TYPE = 111;

// Constrained Baseline 3.1 is the one profile accepted by every browser.
const h264 = {
    mimeType: 'video/H264',
    clockRate: 90000,
    payloadType: H264_PAYLOAD_TYPE,
    parameters:
        'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
};

export const H264_CODEC = new RTCRtpCodecParameters(h264);

// werift drops a PLI unless the feedback was negotiated.
export const H264_KEYFRAME_REQUEST_CODEC = new RTCRtpCodecParameters({
    ...h264,
    rtcpFeedback: [usePLI()],
});

export const OPUS_CODEC = new RTCRtpCodecParameters({
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    payloadType: OPUS_PAYLOAD_TYPE,
});
