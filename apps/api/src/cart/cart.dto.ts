import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export const VARIANT_ID_PATTERN = /^[1-9][0-9]{0,19}$/;

export class CartQuantityDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity!: number;
}

export class AddCartItemDto extends CartQuantityDto {
  @IsString()
  @Matches(VARIANT_ID_PATTERN)
  variantId!: string;
}
