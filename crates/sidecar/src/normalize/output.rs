use std::{
    io::{self, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Arc, Mutex, PoisonError},
};

use super::pipeline::Format;

pub trait Output: Send {
    fn write(&mut self, frame: &[u8]) -> io::Result<()>;
}

pub struct OutputHandle {
    pub output: Box<dyn Output>,
    pub kill: Box<dyn FnOnce() + Send>,
}

pub struct FfmpegOutput {
    child: Arc<Mutex<Child>>,
    stdin: ChildStdin,
}

fn input_args(format: &Format) -> Vec<String> {
    let size = format!("{}x{}", format.size.width, format.size.height);
    let rate = format!("{}/{}", format.fps.numerator, format.fps.denominator);

    [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "yuv420p",
        "-video_size",
        &size,
        "-framerate",
        &rate,
        "-i",
        "pipe:0",
    ]
    .map(String::from)
    .to_vec()
}

fn kill(child: &Mutex<Child>) {
    let mut child = child.lock().unwrap_or_else(PoisonError::into_inner);
    let _ = child.kill();
    let _ = child.wait();
}

pub fn spawn_ffmpeg(
    ffmpeg: &str,
    format: &Format,
    output_args: &[String],
) -> io::Result<OutputHandle> {
    let mut child = Command::new(ffmpeg)
        .args(input_args(format))
        .args(output_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .spawn()?;
    let stdin = child.stdin.take().ok_or(io::ErrorKind::BrokenPipe)?;
    let child = Arc::new(Mutex::new(child));

    let killed = child.clone();
    Ok(OutputHandle {
        output: Box::new(FfmpegOutput { child, stdin }),
        kill: Box::new(move || kill(&killed)),
    })
}

impl Output for FfmpegOutput {
    fn write(&mut self, frame: &[u8]) -> io::Result<()> {
        self.stdin.write_all(frame)
    }
}

impl Drop for FfmpegOutput {
    fn drop(&mut self) {
        kill(&self.child);
    }
}
