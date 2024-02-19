import {ManagerApi} from './api';

const CHUNK_SIZE = 1024 * 1024; // 1MB

async function sendChunk(chunk: Blob, chunkIndex: number, uploadId: string) {
    const query = new URLSearchParams({ chunk: chunkIndex.toString(), id: uploadId });
    const res = await fetch(`/api/upload/chunk?${query}`, {
        method: 'POST',
        body: chunk,
    });

    if (await res.text() !== 'OK') throw new Error('Failed to send chunk');
}

export function getChunkSize() {
    return CHUNK_SIZE;
}

export function getChunkCount(file: Blob) {
    return Math.ceil(file.size / getChunkSize());
}

async function _uploadFile(id: string, file: Blob, data: {canceled: boolean}, onProgress?: (progress: number) => void) {
    const CHUNK_COUNT = getChunkCount(file);

    let sent = 0;
    for (let limit = 100; sent < CHUNK_COUNT; limit += 100) {
        if (data.canceled) {
            await ManagerApi.getConnection().caspar.cancelUpload(id);
            return;
        }

        const promises = [];
        for (let i = sent; i < CHUNK_COUNT && i < limit; i++) {
            const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            promises.push(
                sendChunk(chunk, i, id)
                    .then(() => sent++)
                    .then(() => onProgress?.(sent / CHUNK_COUNT)),
            );
        }

        await Promise.all(promises);
    }
}

export function uploadFile(id: string, file: Blob, onProgress?: (progress: number) => void) {
    const data = { canceled: false };
    const promise = _uploadFile(id, file, data, onProgress);
    return [promise, () => data.canceled = true] as const;
}