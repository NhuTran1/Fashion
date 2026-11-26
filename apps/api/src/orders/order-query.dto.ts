import { NotFoundException } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CatalogPageQuery } from '../catalog/product-list.query';

const ADVANCE_TARGETS = ['CONFIRMED', 'PACKING', 'SHIPPING'] as const;
const ORDER_STATUSES = [
  'PENDING',
  ...ADVANCE_TARGETS,
  'DELIVERED',
  'CANCELLED',
] as const;
const MAX_MYSQL_ID = 18_446_744_073_709_551_615n;

export type AdvanceTarget = (typeof ADVANCE_TARGETS)[number];

export class AdminOrderPageQuery extends CatalogPageQuery {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];
}

export class OrderTransitionDto {
  @IsIn(ADVANCE_TARGETS)
  status!: AdvanceTarget;
}

export class CancellationDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}

/** Chuyển ID đơn hợp lệ sang BigInt và dùng cùng lỗi với đơn không tồn tại. */
export function parseOrderId(value: string): bigint {
  if (!/^[1-9][0-9]{0,19}$/.test(value)) throw new NotFoundException();
  const id = BigInt(value);
  if (id > MAX_MYSQL_ID) throw new NotFoundException();
  return id;
}
