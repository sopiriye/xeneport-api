import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'investor@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string = '';

  @ApiProperty({ example: '123456', description: '6-digit email OTP.' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit numeric code' })
  otp: string = '';
}
