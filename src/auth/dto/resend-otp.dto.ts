import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({ example: 'investor@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;
}
