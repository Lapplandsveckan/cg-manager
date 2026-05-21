import {RtpHeader, RtpPacket} from 'werift';

// MTU-safe payload size for RTP over loopback / standard Ethernet. Could
// push higher on loopback but werift then SRTP-encrypts and sends via UDP
// to the browser; 1200 stays under most-common ICE candidate MTUs.
const MAX_PAYLOAD = 1200;

const FU_A_NAL_TYPE = 28;

// Common NAL unit type codes from H.264 Annex B.
const NAL_TYPE_NON_IDR_SLICE = 1;
const NAL_TYPE_IDR_SLICE = 5;
const NAL_TYPE_AUD = 9;

/**
 * Annex-B NALU splitter. Push raw bytes from the ffmpeg `h264` muxer
 * (TCP-framed in our case) and pull complete NAL units back out. Handles
 * both 3-byte and 4-byte start codes and start codes that straddle chunk
 * boundaries.
 */
export class NaluSplitter {
    private buf: Buffer = Buffer.alloc(0);
    // Have we already consumed at least one start code? If not, bytes
    // before the first start code aren't part of any NALU and get dropped.
    private inProgress = false;

    public push(chunk: Buffer): Buffer[] {
        this.buf = Buffer.concat([this.buf, chunk]);
        const nalus: Buffer[] = [];

        let scan = 0;
        let naluStart = this.inProgress ? 0 : -1;

        while (scan + 2 < this.buf.length) {
            const isThree = this.buf[scan] === 0 && this.buf[scan + 1] === 0 && this.buf[scan + 2] === 1;
            const isFour =
                this.buf[scan] === 0 && this.buf[scan + 1] === 0 && this.buf[scan + 2] === 0
                && scan + 3 < this.buf.length && this.buf[scan + 3] === 1;
            if (!isThree && !isFour) { scan++; continue; }

            const scLen = isFour ? 4 : 3;
            if (naluStart >= 0) {
                const nal = this.buf.subarray(naluStart, scan);
                if (nal.length > 0) nalus.push(Buffer.from(nal));
            }
            naluStart = scan + scLen;
            scan = naluStart;
            this.inProgress = true;
        }

        // Trim. After the loop, `naluStart` either marks the start of an
        // in-progress NALU (everything from there onward stays buffered for
        // next push) or is -1 if we never saw a start code (keep the last
        // 3 bytes in case a start code is mid-split across chunks).
        if (naluStart < 0) {
            const keep = Math.min(3, this.buf.length);
            this.buf = this.buf.length > keep
                ? Buffer.from(this.buf.subarray(this.buf.length - keep))
                : this.buf;
        } else 
            this.buf = Buffer.from(this.buf.subarray(naluStart));
        
        return nalus;
    }
}

interface PacketizerOptions {
    payloadType: number;
    ssrc: number;
    /** Fixed source frame rate; used to advance the 90kHz timestamp once per
     *  detected access unit. Doesn't have to be exact — drift between this
     *  and the encoder's actual fps just affects displayed PTS, not playback. */
    fps: number;
}

/**
 * Wraps Annex-B NAL units into H.264/RTP packets per RFC 6184. Single-NAL
 * mode when the NALU fits MTU; FU-A fragmentation otherwise. The user
 * pushes raw bytes via `push(chunk)`, gets a flat list of RtpPackets back.
 */
export class H264Packetizer {
    private readonly splitter = new NaluSplitter();
    private readonly payloadType: number;
    private readonly ssrc: number;
    private readonly clockTicksPerFrame: number;

    private seq: number;
    private timestamp = 0;
    // Bumped on the next NALU after a marker'd packet so an AU's optional
    // SPS/PPS/SEI prologue lands on the same timestamp as its VCL slice.
    private advanceBeforeNext = false;

    constructor(opts: PacketizerOptions) {
        this.payloadType = opts.payloadType;
        this.ssrc = opts.ssrc;
        this.clockTicksPerFrame = Math.round(90000 / opts.fps);
        this.seq = Math.floor(Math.random() * 0xffff);
    }

    public push(chunk: Buffer): RtpPacket[] {
        const out: RtpPacket[] = [];
        for (const nalu of this.splitter.push(chunk)) {
            if (this.advanceBeforeNext) {
                this.timestamp = (this.timestamp + this.clockTicksPerFrame) >>> 0;
                this.advanceBeforeNext = false;
            }

            const naluType = nalu[0] & 0x1f;
            // AUD by itself doesn't need transmitting — browsers ignore it.
            // But it's also a clean access-unit boundary signal: treat as
            // "advance on next NALU" and skip emitting.
            if (naluType === NAL_TYPE_AUD) {
                this.advanceBeforeNext = true;
                continue;
            }

            const isLastOfAu = naluType === NAL_TYPE_NON_IDR_SLICE || naluType === NAL_TYPE_IDR_SLICE;
            for (const pkt of this.packetize(nalu, isLastOfAu)) out.push(pkt);
            if (isLastOfAu) this.advanceBeforeNext = true;
        }
        return out;
    }

    private packetize(nalu: Buffer, marker: boolean): RtpPacket[] {
        if (nalu.length <= MAX_PAYLOAD) return [this.makePacket(nalu, marker)];

        const nalHeader = nalu[0];
        const fnri = nalHeader & 0xe0; // F (1 bit) + NRI (2 bits)
        const type = nalHeader & 0x1f;
        const fuIndicator = fnri | FU_A_NAL_TYPE;

        const body = nalu.subarray(1);
        const chunkSize = MAX_PAYLOAD - 2; // 2 bytes for FU indicator + header
        const packets: RtpPacket[] = [];

        for (let off = 0; off < body.length; off += chunkSize) {
            const end = Math.min(off + chunkSize, body.length);
            const isFirst = off === 0;
            const isLast = end === body.length;
            const fuHeader = (isFirst ? 0x80 : 0) | (isLast ? 0x40 : 0) | type;
            const payload = Buffer.concat([
                Buffer.from([fuIndicator, fuHeader]),
                body.subarray(off, end),
            ]);
            packets.push(this.makePacket(payload, marker && isLast));
        }
        return packets;
    }

    private makePacket(payload: Buffer, marker: boolean): RtpPacket {
        const header = new RtpHeader({
            version: 2,
            payloadType: this.payloadType,
            sequenceNumber: this.seq,
            timestamp: this.timestamp,
            ssrc: this.ssrc,
            marker,
        });
        this.seq = (this.seq + 1) & 0xffff;
        return new RtpPacket(header, payload);
    }
}
