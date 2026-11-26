import { extname } from 'node:path';
import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// eslint-disable-next-line no-control-regex -- Phải nhận diện ký tự điều khiển để từ chối tên file.
const CONTROL_OR_PATH_IN_FILENAME = /[/\\:\x00-\x1f\x7f]/;

export type ImageFormat = 'jpg' | 'png';
export const IMAGE_MEDIA_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
} as const;

export type UploadedProductImage = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

// Chỉ chấp nhận khóa do server sinh để tạo đường dẫn cố định bên trong thư mục ảnh.
export function isProductImageKey(storageKey: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/.test(
    storageKey,
  );
}

// Phân loại ảnh theo dữ liệu và kiểm tra ảnh giải mã được trong giới hạn tài nguyên.
export function validateImageContent(bytes: Buffer, format: ImageFormat): void {
  if (!bytes.length) throw new BadRequestException();
  if (bytes.length > MAX_PRODUCT_IMAGE_BYTES)
    throw new PayloadTooLargeException();

  const signatureMatches =
    format === 'png'
      ? bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
      : bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!signatureMatches) throw new UnsupportedMediaTypeException();

  try {
    if (format === 'png') {
      // Đọc kích thước IHDR trước khi decoder cấp bộ nhớ cho pixel.
      if (
        bytes.length < 33 ||
        bytes.readUInt32BE(8) !== 13 ||
        bytes.toString('ascii', 12, 16) !== 'IHDR'
      )
        throw new BadRequestException();
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      if (!width || !height || width * height > MAX_IMAGE_PIXELS)
        throw new BadRequestException();
      if (
        bytes.readUInt32BE(bytes.length - 12) !== 0 ||
        bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND'
      )
        throw new BadRequestException();
      PNG.sync.read(bytes, { checkCRC: true });
    } else {
      if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9)
        throw new BadRequestException();
      const image = decodeJpeg(bytes, {
        maxResolutionInMP: MAX_IMAGE_PIXELS / 1_000_000,
        maxMemoryUsageInMB: 128,
        tolerantDecoding: false,
      });
      if (!image.width || !image.height) throw new BadRequestException();
    }
  } catch {
    throw new BadRequestException();
  }
}

/** Kiểm tra tên, phần mở rộng và MIME trước khi xác minh nội dung ảnh. */
export function validateUpload(file: UploadedProductImage): ImageFormat {
  const { originalname, mimetype, buffer } = file;
  if (
    !originalname ||
    CONTROL_OR_PATH_IN_FILENAME.test(originalname) ||
    Buffer.byteLength(originalname, 'utf8') > 255
  ) {
    throw new BadRequestException();
  }

  const extension = extname(originalname).toLowerCase();
  const format =
    extension === '.jpg' || extension === '.jpeg'
      ? 'jpg'
      : extension === '.png'
        ? 'png'
        : undefined;
  if (!format || IMAGE_MEDIA_TYPES[format] !== mimetype)
    throw new UnsupportedMediaTypeException();

  validateImageContent(buffer, format);
  return format;
}
