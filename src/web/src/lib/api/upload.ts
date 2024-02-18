const CHUNK_SIZE = 1024 * 1024; // 1MB

async function sendChunk(chunk: Blob, chunkIndex: number, uploadId: string) {
    const query = new URLSearchParams({ chunk: chunkIndex.toString(), id: uploadId });
    const res = await fetch(`/upload/chunk?${query}`, {
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

export async function uploadFile(id: string, file: Blob) {
    const CHUNK_COUNT = getChunkCount(file);

    const promises = [];
    for (let i = 0; i < CHUNK_COUNT; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        promises.push(sendChunk(chunk, i, id));
    }

    await Promise.all(promises);
}