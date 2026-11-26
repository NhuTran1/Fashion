import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  Equals,
  IsArray,
  IsObject,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { AddCartItemDto, VARIANT_ID_PATTERN } from '../cart/cart.dto';

export class CheckoutDto {
  @IsString()
  @Matches(VARIANT_ID_PATTERN)
  addressId!: string;

  @Equals('COD')
  method!: 'COD';

  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}
