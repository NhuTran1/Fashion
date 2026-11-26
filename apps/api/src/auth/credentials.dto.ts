import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// DTO công khai chỉ nhận email và mật khẩu.
export class CredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
