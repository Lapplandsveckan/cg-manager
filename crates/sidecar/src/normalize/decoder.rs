use openh264::formats::YUVSource;

use super::frame::{Picture, Plane, Size};

pub trait Decoder: Send {
    fn decode(&mut self, access_unit: &[u8], sink: &mut dyn FnMut(&Picture)) -> Result<(), String>;
}

pub struct OpenH264Decoder {
    decoder: openh264::decoder::Decoder,
}

impl OpenH264Decoder {
    pub fn new() -> Result<OpenH264Decoder, String> {
        openh264::decoder::Decoder::new()
            .map(|decoder| OpenH264Decoder { decoder })
            .map_err(|error| error.to_string())
    }
}

impl Decoder for OpenH264Decoder {
    fn decode(&mut self, access_unit: &[u8], sink: &mut dyn FnMut(&Picture)) -> Result<(), String> {
        let decoded = self
            .decoder
            .decode(access_unit)
            .map_err(|error| error.to_string())?;
        let Some(yuv) = decoded else {
            return Ok(());
        };

        let (width, height) = yuv.dimensions();
        let (y_stride, u_stride, v_stride) = yuv.strides();
        sink(&Picture {
            size: Size { width, height },
            y: Plane {
                data: yuv.y(),
                stride: y_stride,
            },
            u: Plane {
                data: yuv.u(),
                stride: u_stride,
            },
            v: Plane {
                data: yuv.v(),
                stride: v_stride,
            },
        });
        Ok(())
    }
}
