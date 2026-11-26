import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IMAGE_MEDIA_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  isProductImageKey,
  type ImageFormat,
} from './product-image-policy';

export interface StoredProductImage {
  bytes: Buffer;
  format: ImageFormat;
  contentType: (typeof IMAGE_MEDIA_TYPES)[ImageFormat];
}

export interface ImageStorage {
  save(bytes: Buffer, format: ImageFormat): Promise<string>;
  read(storageKey: string): Promise<StoredProductImage>;
  remove(storageKey: string): Promise<void>;
}

// Nhận biết file hoặc thư mục đã biến mất để trả 404 mà không lộ đường dẫn local.
function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

@Injectable()
export class LocalImageStorage implements ImageStorage {
  private readonly root = resolve(
    __dirname,
    '../../../../',
    process.env.PRODUCT_IMAGE_DIR || 'storage/local/product-images',
  );

  /** Tạo khóa mới và ghi file độc quyền để không ghi đè ảnh đang dùng. */
  async save(bytes: Buffer, format: ImageFormat): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const root = await realpath(this.root);
    const key = randomUUID() + '.' + format;
    const path = join(root, key);
    const file = await open(path, 'wx', 0o600);
    try {
      try {
        await file.writeFile(bytes);
      } finally {
        await file.close();
      }
    } catch (error) {
      await unlink(path);
      throw error;
    }
    return key;
  }

  /** Đọc file thường bên trong thư mục ảnh và từ chối symlink. */
  async read(storageKey: string): Promise<StoredProductImage> {
    if (!isProductImageKey(storageKey)) throw new NotFoundException();
    try {
      const root = await realpath(this.root);
      const path = join(root, storageKey);
      const known = await lstat(path);
      if (
        !known.isFile() ||
        known.size === 0 ||
        known.size > MAX_PRODUCT_IMAGE_BYTES
      )
        throw new NotFoundException();

      const file = await open(
        path,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      try {
        const current = await file.stat();
        if (
          !current.isFile() ||
          known.ino !== current.ino ||
          known.dev !== current.dev ||
          current.size === 0 ||
          current.size > MAX_PRODUCT_IMAGE_BYTES
        )
          throw new NotFoundException();

        const buffer = Buffer.alloc(current.size);
        let offset = 0;
        while (offset < buffer.length) {
          const { bytesRead } = await file.read(
            buffer,
            offset,
            buffer.length - offset,
            offset,
          );
          if (!bytesRead) throw new NotFoundException();
          offset += bytesRead;
        }
        const format = storageKey.endsWith('.png') ? 'png' : 'jpg';
        return {
          bytes: buffer,
          format,
          contentType: IMAGE_MEDIA_TYPES[format],
        };
      } finally {
        await file.close();
      }
    } catch (error) {
      if (
        isMissing(error) ||
        (error instanceof Error && 'code' in error && error.code === 'ELOOP')
      )
        throw new NotFoundException();
      throw error;
    }
  }

  /** Dọn đúng file mới tạo khi bước lưu metadata bị từ chối. */
  async remove(storageKey: string): Promise<void> {
    if (!isProductImageKey(storageKey)) throw new NotFoundException();
    try {
      await unlink(join(await realpath(this.root), storageKey));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}
