import {
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

// DTO giới hạn các trường địa chỉ mà Customer có thể gửi.
export class CreateAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone!: string;

  @IsString()
  @MinLength(1)
  addressText!: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsBoolean()
  isDefault?: boolean;
}

// PATCH phân biệt trường vắng mặt với null để giữ đúng contract.
export class UpdateAddressDto {
  @ValidateIf((_body, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name?: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  phone?: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  addressText?: string;

  @ValidateIf((_body, value) => value !== undefined)
  @IsBoolean()
  isDefault?: boolean;
}
