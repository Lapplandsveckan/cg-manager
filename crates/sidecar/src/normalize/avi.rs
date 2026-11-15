use std::io::{self, Read};

const MAX_FRAME_BYTES: usize = 256 * 1024 * 1024;

fn is_list(id: &[u8]) -> bool {
    id == b"RIFF" || id == b"LIST"
}

fn is_video(id: &[u8]) -> bool {
    id.ends_with(b"dc") || id.ends_with(b"db")
}

fn read_chunk(reader: &mut impl Read, size: usize) -> io::Result<Vec<u8>> {
    if size > MAX_FRAME_BYTES {
        return Err(io::ErrorKind::InvalidData.into());
    }

    let padding = size & 1;
    let mut data = vec![0u8; size + padding];
    reader.read_exact(&mut data)?;
    data.truncate(size);
    Ok(data)
}

pub fn read_frames(mut reader: impl Read, mut on_frame: impl FnMut(Vec<u8>)) -> io::Result<()> {
    loop {
        let mut header = [0u8; 8];
        reader.read_exact(&mut header)?;
        let (id, size) = header.split_at(4);

        // A piped AVI has placeholder list sizes, so lists are entered, never skipped.
        if is_list(id) {
            reader.read_exact(&mut [0u8; 4])?;
            continue;
        }

        let size = u32::from_le_bytes(size.try_into().unwrap()) as usize;
        let data = read_chunk(&mut reader, size)?;
        if is_video(id) && !data.is_empty() {
            on_frame(data);
        }
    }
}
