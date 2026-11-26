import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Address } from '../generated/prisma/client';
import type { CreateAddressDto, UpdateAddressDto } from './address.dto';
import { DatabaseService } from '../database/database.service';

// Chuyển kết quả sang schema Address, chỉ lộ các trường được phép.
function publicAddress({ id, name, phone, addressText, isDefault }: Address) {
  return { id: id.toString(), name, phone, addressText, isDefault };
}

// MySQL TEXT giới hạn theo byte, nên chuỗi Unicode cần kiểm tra theo UTF-8.
function validateAddressText(value: string | undefined): void {
  if (value !== undefined && Buffer.byteLength(value, 'utf8') > 65_535)
    throw new BadRequestException();
}

@Injectable()
export class MeService {
  constructor(private readonly database: DatabaseService) {}

  /** Chỉ đọc địa chỉ gắn với ID lấy từ phiên đã xác thực. */
  async listAddresses(userId: bigint) {
    const addresses = await this.database.client.address.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    });
    return addresses.map(publicAddress);
  }

  /** Tạo địa chỉ thuộc Customer đang đăng nhập. */
  async createAddress(userId: bigint, data: CreateAddressDto) {
    validateAddressText(data.addressText);
    const address = await this.database.client.address.create({
      data: { ...data, userId },
    });
    return publicAddress(address);
  }

  /** Cập nhật địa chỉ với điều kiện sở hữu trong cùng thao tác Prisma. */
  async updateAddress(userId: bigint, id: bigint, data: UpdateAddressDto) {
    if (Object.values(data).every((value) => value === undefined))
      throw new BadRequestException();
    validateAddressText(data.addressText);

    try {
      const address = await this.database.client.address.update({
        where: { id, userId },
        data,
      });
      return publicAddress(address);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new NotFoundException();
      throw error;
    }
  }
}
