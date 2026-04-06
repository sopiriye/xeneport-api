import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import type { AuthenticatedUser } from './types/authenticated-user.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register investor account',
    description:
      'Creates a new investor account and issues an email verification OTP.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description:
      'Account created successfully. OTP sent for email verification.',
    schema: {
      example: {
        message:
          'Registration successful. Verify the OTP sent to your email address before logging in.',
        user: {
          id: '4c2a90b2-e968-4a9a-b071-9cfcbcc8f4d4',
          firstName: 'Sopiriye',
          lastName: 'Robinson',
          email: 'investor@example.com',
          status: 'active',
          emailVerified: false,
          emailVerifiedAt: null,
          lastLoginAt: null,
          createdAt: '2026-03-30T10:00:00.000Z',
          updatedAt: '2026-03-30T10:00:00.000Z',
        },
        otpPreview: '123456',
      },
    },
  })
  @ApiConflictResponse({ description: 'Email already exists.' })
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post('verify-otp')
  @ApiOperation({
    summary: 'Verify email OTP',
    description:
      'Verifies the email OTP issued at registration or resend time.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description: 'OTP verified successfully.',
    schema: {
      example: {
        message: 'Email verified successfully. You can now log in.',
        user: {
          id: '4c2a90b2-e968-4a9a-b071-9cfcbcc8f4d4',
          firstName: 'Sopiriye',
          lastName: 'Robinson',
          email: 'investor@example.com',
          status: 'active',
          emailVerified: true,
          emailVerifiedAt: '2026-03-30T10:05:00.000Z',
          lastLoginAt: null,
          createdAt: '2026-03-30T10:00:00.000Z',
          updatedAt: '2026-03-30T10:05:00.000Z',
        },
      },
    },
  })
  verifyOtp(@Body() payload: VerifyOtpDto) {
    return this.authService.verifyOtp(payload);
  }

  @Post('resend-otp')
  @ApiOperation({
    summary: 'Resend verification OTP',
    description:
      'Invalidates any active email verification OTP and sends a new one.',
  })
  @ApiBody({ type: ResendOtpDto })
  @ApiOkResponse({
    description: 'OTP resent successfully.',
    schema: {
      example: {
        message: 'A new OTP has been sent to your email address.',
        otpPreview: '654321',
      },
    },
  })
  resendOtp(@Body() payload: ResendOtpDto) {
    return this.authService.resendOtp(payload);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login investor',
    description:
      'Authenticates a verified investor and returns a bearer access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful.',
    schema: {
      example: {
        message: 'Login successful',
        accessToken: 'jwt-token-value',
        tokenType: 'Bearer',
        expiresIn: '15m',
        user: {
          id: '4c2a90b2-e968-4a9a-b071-9cfcbcc8f4d4',
          firstName: 'Sopiriye',
          lastName: 'Robinson',
          email: 'investor@example.com',
          status: 'active',
          emailVerified: true,
          emailVerifiedAt: '2026-03-30T10:05:00.000Z',
          lastLoginAt: '2026-03-30T10:10:00.000Z',
          createdAt: '2026-03-30T10:00:00.000Z',
          updatedAt: '2026-03-30T10:10:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiForbiddenResponse({
    description: 'Email not verified or account status blocks login.',
  })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout current investor session',
    description: 'Revokes the currently authenticated session.',
  })
  @ApiOkResponse({
    description: 'Logout successful.',
    schema: {
      example: {
        message: 'Logout successful',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  logout(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.logout(currentUser);
  }
}
