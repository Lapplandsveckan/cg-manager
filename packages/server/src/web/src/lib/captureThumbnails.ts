import { noTryAsync } from 'no-try';

const INTERVAL_MS = 5000;
const WIDTH = 320;
const QUALITY = 0.6;

const toJpeg = (canvas: HTMLCanvasElement) =>
    new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );

/** Thumbnails come from the sender, not the host: the ingest leg is a
 *  stream copy, so decoding a frame server-side would cost more than the whole
 *  session does. Posts a small JPEG of the captured video every few seconds
 *  and returns the stop handle. */
export function startThumbnailUploads(
    stream: MediaStream,
    endpoint: string,
): () => void {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    void video.play();

    const canvas = document.createElement('canvas');

    const post = async () => {
        if (!video.videoWidth) return;

        canvas.width = WIDTH;
        canvas.height = Math.round(
            (video.videoHeight / video.videoWidth) * WIDTH,
        );
        canvas
            .getContext('2d')
            ?.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob = await toJpeg(canvas);
        if (!blob) return;

        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: blob,
        });
    };

    const upload = () => void noTryAsync(post);
    const timer = setInterval(upload, INTERVAL_MS);
    upload();

    return () => {
        clearInterval(timer);
        video.srcObject = null;
    };
}
