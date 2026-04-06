import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpTtlMinutes = this.parsePositiveInteger(
    process.env.OTP_TTL_MINUTES,
    10,
  );
  private readonly sessionTtlDays = this.parsePositiveInteger(
    process.env.AUTH_SESSION_TTL_DAYS,
    7,
  );
  private readonly accessTokenExpiresIn =
    process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  private readonly isProduction = process.env.NODE_ENV ?? 'production';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: RegisterDto) {
    const email = this.normalizeEmail(payload.email);

    const existingUser = await this.databaseService.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = this.hashPassword(payload.password);

    const user = await this.databaseService.user.create({
      data: {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: email,
        passwordHash: passwordHash,
      },
    });

    const otpCode = await this.issueVerificationOtp(user.id, user.email);

    return {
      message:
        'Registration successful. Verify the OTP sent to your email address before logging in.',
      user: this.toPublicUser(user),
      ...(this.isProduction ? {} : { otpPreview: otpCode }),
    };
  }

  async verifyOtp(payload: VerifyOtpDto) {
    const email = this.normalizeEmail(payload.email);

    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User account was not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email has already been verified');
    }

    const otpRecord = await this.databaseService.verificationOtp.findFirst({
      where: {
        email,
        purpose: 'email_verification',
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('No active OTP was found for this email');
    }

    if (otpRecord.expiresAt <= new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    const isValidOtp = this.verifyHash(payload.otp, otpRecord.codeHash);

    if (!isValidOtp) {
      throw new BadRequestException('Invalid OTP');
    }

    await this.databaseService.$transaction([
      this.databaseService.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
        },
      }),
      this.databaseService.verificationOtp.update({
        where: { id: otpRecord.id },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.databaseService.verificationOtp.deleteMany({
        where: {
          userId: user.id,
          id: { not: otpRecord.id },
          purpose: 'email_verification',
          consumedAt: null,
        },
      }),
    ]);

    const verifiedUser = await this.databaseService.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    return {
      message: 'Email verified successfully. You can now log in.',
      user: this.toPublicUser(verifiedUser),
    };
  }

  async resendOtp(payload: ResendOtpDto) {
    const email = this.normalizeEmail(payload.email);

    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User account was not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email has already been verified');
    }

    const otpCode = await this.issueVerificationOtp(user.id, user.email);

    return {
      message: 'A new OTP has been sent to your email address.',
      ...(this.isProduction ? {} : { otpPreview: otpCode }),
    };
  }

  async login(payload: LoginDto) {
    const email = this.normalizeEmail(payload.email);

    const user = await this.databaseService.user.findUnique({
      where: { email },
    });

    if (!user || !this.verifyHash(payload.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email before logging in');
    }

    if (user.status !== 'active') {
      throw new ForbiddenException('Your account is not allowed to log in');
    }

    const sessionId = cryptoRandomId();
    const refreshToken = cryptoRandomId(48);
    const expiresAt = new Date(
      Date.now() + this.sessionTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.databaseService.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashValue(refreshToken),
        expiresAt: expiresAt,
        lastUsedAt: new Date(),
      },
    });

    await this.databaseService.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      sid: sessionId,
    });

    return {
      message: 'Login successful',
      accessToken: accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenExpiresIn,
      user: this.toPublicUser({
        ...user,
        lastLoginAt: new Date(),
      }),
    };
  }

  async logout(currentUser: AuthenticatedUser) {
    await this.databaseService.authSession.updateMany({
      where: {
        id: currentUser.sessionId,
        userId: currentUser.userId,
        status: 'active',
      },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    return {
      message: 'Logout successful',
    };
  }

  private async issueVerificationOtp(userId: string, email: string) {
    const otpCode = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.otpTtlMinutes * 60 * 1000);

    await this.databaseService.verificationOtp.deleteMany({
      where: {
        userId,
        purpose: 'email_verification',
        consumedAt: null,
      },
    });

    await this.databaseService.verificationOtp.create({
      data: {
        userId,
        email,
        purpose: 'email_verification',
        codeHash: this.hashValue(otpCode),
        expiresAt,
      },
    });

    this.logger.log(`OTP for ${email}: ${otpCode}`);

    return otpCode;
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private parsePositiveInteger(value: string | undefined, fallback: number) {
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');

    return `${salt}:${derivedKey}`;
  }

  private verifyHash(value: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');

    if (!salt || !originalHash) {
      return false;
    }

    const derivedKey = scryptSync(value, salt, 64);
    const storedKey = Buffer.from(originalHash, 'hex');

    if (derivedKey.length !== storedKey.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedKey);
  }

  private hashValue(value: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(value, salt, 64).toString('hex');

    return `${salt}:${derivedKey}`;
  }

  private toPublicUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

function cryptoRandomId(size = 32): string {
  return randomBytes(size).toString('hex');
}
