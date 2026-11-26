import {
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';

export const MAX_STOCK_QUANTITY = 2_147_483_647;
const MIN_MOVEMENT_DELTA = -2_147_483_648;

export class InventoryAdjustmentDto {
  @IsInt()
  @Min(MIN_MOVEMENT_DELTA)
  @Max(MAX_STOCK_QUANTITY)
  @NotEquals(0)
  delta!: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}
