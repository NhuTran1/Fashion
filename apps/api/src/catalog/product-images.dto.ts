import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateProductImageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  storageKey!: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  sortOrder?: number;
}

export class UpdateProductImageDto {
  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  storageKey?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ValidateIf((_input, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  sortOrder?: number;
}
