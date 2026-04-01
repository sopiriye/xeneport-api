import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Sopiriye' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Robinson' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'investor@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Str0ngPass!23',
    minLength: 8,
    description:
      'At least 8 characters and must include uppercase, lowercase, number, and special character.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message:
      'password must include uppercase, lowercase, number, and special character',
  })
  password: string;
}
