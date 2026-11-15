use std::{
    thread,
    time::{Duration, Instant},
};

use super::{
    decoder::OpenH264Decoder,
    frame::Size,
    output::spawn_ffmpeg,
    pipeline::{tick_time, Format, Fps, Normalizer, Pushed},
};
use crate::relay::annexb::Splitter;

const USAGE: &str = "usage: cg-sidecar normalize --input <clip.h264> --sink <url>
    [--width 1280] [--height 720] [--fps 30] [--input-fps 30]
    [--gap <start seconds>:<length seconds>] [--ffmpeg ffmpeg]";

struct Gap {
    start: Duration,
    length: Duration,
}

struct Options {
    input: String,
    sink: String,
    ffmpeg: String,
    format: Format,
    input_fps: Fps,
    gap: Option<Gap>,
}

fn whole_fps(rate: u32) -> Fps {
    Fps {
        numerator: rate,
        denominator: 1,
    }
}

fn parse_gap(text: &str) -> Option<Gap> {
    let (start, length) = text.split_once(':')?;
    Some(Gap {
        start: Duration::from_secs_f64(start.parse().ok()?),
        length: Duration::from_secs_f64(length.parse().ok()?),
    })
}

fn parse_options(args: &[String]) -> Option<Options> {
    let value = |flag: &str| {
        args.iter()
            .position(|arg| arg == flag)
            .and_then(|index| args.get(index + 1))
            .cloned()
    };
    let number = |flag: &str, fallback: u32| {
        value(flag)
            .and_then(|text| text.parse().ok())
            .unwrap_or(fallback)
    };

    Some(Options {
        input: value("--input")?,
        sink: value("--sink")?,
        ffmpeg: value("--ffmpeg").unwrap_or_else(|| "ffmpeg".into()),
        format: Format {
            size: Size::even(
                number("--width", 1280) as usize,
                number("--height", 720) as usize,
            ),
            fps: whole_fps(number("--fps", 30)),
        },
        input_fps: whole_fps(number("--input-fps", 30)),
        gap: value("--gap").and_then(|text| parse_gap(&text)),
    })
}

fn output_args(sink: &str) -> Vec<String> {
    [
        "-c:v",
        "mpeg2video",
        "-g",
        "1",
        "-q:v",
        "3",
        "-f",
        "mpegts",
        sink,
    ]
    .map(String::from)
    .to_vec()
}

fn feed(normalizer: &Normalizer, access_units: &[Vec<u8>], options: &Options) {
    let start = Instant::now();
    let interval = tick_time(1, options.input_fps);
    let mut gap = options.gap.as_ref();

    for access_unit in access_units.iter().cycle() {
        thread::sleep(interval);

        if let Some(pause) = gap.filter(|pause| start.elapsed() >= pause.start) {
            eprintln!("gap: sending nothing for {:?}", pause.length);
            thread::sleep(pause.length);
            gap = None;
        }
        if normalizer.push(access_unit.clone()) != Pushed::Queued {
            eprintln!("decoder is behind, dropped an access unit");
        }
    }
}

pub fn run(args: &[String]) -> Result<(), String> {
    let options = parse_options(args).ok_or(USAGE)?;

    let bytes =
        std::fs::read(&options.input).map_err(|error| format!("{}: {error}", options.input))?;
    let access_units: Vec<Vec<u8>> = Splitter::default()
        .push(&bytes)
        .into_iter()
        .map(|frame| frame.data)
        .collect();
    if access_units.is_empty() {
        return Err(format!("{}: no H.264 access units found", options.input));
    }

    let (mut normalizer, notices) = Normalizer::start(Box::new(OpenH264Decoder::new()?));
    let output = spawn_ffmpeg(
        &options.ffmpeg,
        &options.format,
        &output_args(&options.sink),
    )
    .map_err(|error| format!("could not start {}: {error}", options.ffmpeg))?;
    normalizer.set_output(options.format, output);

    thread::spawn(move || notices.iter().for_each(|notice| eprintln!("{notice:?}")));
    feed(&normalizer, &access_units, &options);
    Ok(())
}
