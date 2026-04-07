import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'investor@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string = '';

  @ApiProperty({ example: 'Str0ngPass!23' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string = '';
}
