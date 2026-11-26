import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const STATUS = ['ACTIVE', 'INACTIVE'] as const;
type CatalogStatus = (typeof STATUS)[number];

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(191)
  slug!: string;

  @IsIn(STATUS)
  status!: CatalogStatus;
}

export class UpdateCategoryDto {
  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  slug?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsIn(STATUS)
  status?: CatalogStatus;
}

export class CreateProductDto extends CreateCategoryDto {
  @Matches(/^[1-9][0-9]{0,19}$/)
  categoryId!: string;

  @IsString()
  description!: string;
}

export class UpdateProductDto extends UpdateCategoryDto {
  @ValidateIf((_input, value) => value !== undefined)
  @Matches(/^[1-9][0-9]{0,19}$/)
  categoryId?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  description?: string;
}

export class CreateVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(48)
  size!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  color!: string;

  @Matches(/^[0-9]{1,10}\.[0-9]{2}$/)
  price!: string;

  @IsIn(STATUS)
  status!: CatalogStatus;
}

export class UpdateVariantDto {
  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  sku?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(48)
  size?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  color?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @Matches(/^[0-9]{1,10}\.[0-9]{2}$/)
  price?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsIn(STATUS)
  status?: CatalogStatus;
}
