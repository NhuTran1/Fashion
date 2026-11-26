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
import { CatalogPageQuery } from '../catalog/product-list.query';

const RESOURCE_ID = /^[1-9][0-9]{0,19}$/;
const MAX_MYSQL_ID = 18_446_744_073_709_551_615n;
const VISIBILITY_STATES = ['VISIBLE', 'HIDDEN'] as const;

export type ReviewVisibility = (typeof VISIBILITY_STATES)[number];

export class AdminReviewPageQuery extends CatalogPageQuery {
  @IsOptional()
  @IsIn(VISIBILITY_STATES)
  status?: ReviewVisibility;
}

export class ReviewModerationDto {
  @IsIn(VISIBILITY_STATES)
  status!: ReviewVisibility;
}

export class CreateReviewDto {
  @IsString()
  @Matches(RESOURCE_ID)
  orderItemId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(1)
  content!: string;
}

/** Chuyển chuỗi ID hợp lệ sang BigInt trong miền khóa MySQL. */
export function parseReviewResourceId(value: string): bigint | undefined {
  if (!RESOURCE_ID.test(value)) return undefined;
  const id = BigInt(value);
  return id <= MAX_MYSQL_ID ? id : undefined;
}
