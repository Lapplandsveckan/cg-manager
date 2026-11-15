use fast_image_resize::{
    images::{Image, ImageRef},
    FilterType, PixelType, ResizeAlg, ResizeOptions, Resizer,
};

const BLACK_LUMA: u8 = 16;
const NEUTRAL_CHROMA: u8 = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Size {
    pub width: usize,
    pub height: usize,
}

impl Size {
    pub fn even(width: usize, height: usize) -> Size {
        Size {
            width: width & !1,
            height: height & !1,
        }
    }

    fn chroma(self) -> Size {
        Size {
            width: self.width.div_ceil(2),
            height: self.height.div_ceil(2),
        }
    }

    fn area(self) -> usize {
        self.width * self.height
    }

    pub fn frame_bytes(self) -> usize {
        self.area() + 2 * self.chroma().area()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rect {
    pub left: usize,
    pub top: usize,
    pub size: Size,
}

impl Rect {
    fn chroma(self) -> Rect {
        Rect {
            left: self.left / 2,
            top: self.top / 2,
            size: self.size.chroma(),
        }
    }
}

pub struct Plane<'a> {
    pub data: &'a [u8],
    pub stride: usize,
}

pub struct Picture<'a> {
    pub size: Size,
    pub y: Plane<'a>,
    pub u: Plane<'a>,
    pub v: Plane<'a>,
}

pub fn black_frame(size: Size) -> Vec<u8> {
    let mut frame = vec![NEUTRAL_CHROMA; size.frame_bytes()];
    frame[..size.area()].fill(BLACK_LUMA);
    frame
}

pub fn letterbox_rect(source: Size, target: Size) -> Rect {
    let fits_width = target.width * source.height <= target.height * source.width;
    let scaled = if fits_width {
        Size::even(target.width, target.width * source.height / source.width)
    } else {
        Size::even(target.height * source.width / source.height, target.height)
    };
    let size = Size {
        width: scaled.width.max(2),
        height: scaled.height.max(2),
    };

    Rect {
        left: ((target.width - size.width) / 2) & !1,
        top: ((target.height - size.height) / 2) & !1,
        size,
    }
}

fn packed_rows(plane: &Plane, size: Size) -> Option<Vec<u8>> {
    let mut packed = Vec::with_capacity(size.area());
    for row in plane.data.chunks(plane.stride).take(size.height) {
        packed.extend_from_slice(row.get(..size.width)?);
    }

    (packed.len() == size.area()).then_some(packed)
}

/// A decoded picture copied out of the decoder, rows packed without stride padding.
pub struct PackedPicture {
    pub size: Size,
    y: Vec<u8>,
    u: Vec<u8>,
    v: Vec<u8>,
}

impl Picture<'_> {
    // Odd dimensions lose their last row or column so chroma is exactly half.
    pub fn pack(&self) -> Option<PackedPicture> {
        let size = Size::even(self.size.width, self.size.height);
        let chroma = size.chroma();

        Some(PackedPicture {
            size,
            y: packed_rows(&self.y, size)?,
            u: packed_rows(&self.u, chroma)?,
            v: packed_rows(&self.v, chroma)?,
        })
    }
}

fn blit(canvas: &mut [u8], canvas_width: usize, pixels: &[u8], rect: Rect) {
    pixels
        .chunks(rect.size.width)
        .enumerate()
        .for_each(|(row, line)| {
            let start = (rect.top + row) * canvas_width + rect.left;
            canvas[start..start + rect.size.width].copy_from_slice(line);
        });
}

pub struct Letterbox {
    target: Size,
    resizer: Resizer,
    options: ResizeOptions,
}

impl Letterbox {
    pub fn new(target: Size) -> Letterbox {
        Letterbox {
            target,
            resizer: Resizer::new(),
            options: ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FilterType::Bilinear)),
        }
    }

    pub fn target(&self) -> Size {
        self.target
    }

    pub fn fit(&mut self, picture: &PackedPicture) -> Option<Vec<u8>> {
        let rect = letterbox_rect(picture.size, self.target);
        let luma_bytes = self.target.area();
        let chroma_bytes = self.target.chroma().area();
        let chroma_width = self.target.chroma().width;

        let mut frame = black_frame(self.target);
        let (y, chroma) = frame.split_at_mut(luma_bytes);
        let (u, v) = chroma.split_at_mut(chroma_bytes);

        let scaled_y = self.scale(&picture.y, picture.size, rect.size)?;
        blit(y, self.target.width, &scaled_y, rect);

        let source_chroma = picture.size.chroma();
        let scaled_u = self.scale(&picture.u, source_chroma, rect.chroma().size)?;
        blit(u, chroma_width, &scaled_u, rect.chroma());

        let scaled_v = self.scale(&picture.v, source_chroma, rect.chroma().size)?;
        blit(v, chroma_width, &scaled_v, rect.chroma());

        Some(frame)
    }

    fn scale(&mut self, pixels: &[u8], from: Size, to: Size) -> Option<Vec<u8>> {
        if from == to {
            return Some(pixels.to_vec());
        }

        let source =
            ImageRef::new(from.width as u32, from.height as u32, pixels, PixelType::U8).ok()?;
        let mut scaled = Image::new(to.width as u32, to.height as u32, PixelType::U8);
        self.resizer
            .resize(&source, &mut scaled, &self.options)
            .ok()?;

        Some(scaled.into_vec())
    }
}
