import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const PRODUCT_SORTS = ['NEWEST', 'PRICE_ASC', 'PRICE_DESC'] as const;
type ProductSort = (typeof PRODUCT_SORTS)[number];

// Chỉ chuyển chuỗi chữ số thập phân của query thành số.
function decimalInteger(value: unknown): number {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}

export class CatalogPageQuery {
  @Transform(({ value }) => decimalInteger(value))
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;

  @Transform(({ value }) => decimalInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class ProductListQuery extends CatalogPageQuery {
  @IsOptional()
  @IsString()
  @MinLength(1)
  q?: string;

  @IsOptional()
  @Matches(/^[1-9][0-9]{0,19}$/)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  size?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  color?: string;

  @IsIn(PRODUCT_SORTS)
  sort: ProductSort = 'NEWEST';
}
