import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMe(currentUser: AuthenticatedUser) {
    // getMe route:
    // Load the authenticated user's account record and reject stale tokens that reference a missing user.
    const user = await this.databaseService.user.findUnique({
      where: { id: currentUser.userId },
    });

    if (!user) {
      throw new NotFoundException('User account was not found');
    }

    // getMe route:
    // Return the normalized public profile payload for the authenticated user.
    return this.toPublicUser(user);
  }

  async updateMe(currentUser: AuthenticatedUser, payload: UpdateProfileDto) {
    // updateMe route:
    // Reject empty profile updates before touching the database.
    if (!payload.firstName && !payload.lastName) {
      throw new BadRequestException(
        'At least one profile field must be provided for update',
      );
    }

    // updateMe route:
    // Confirm that the authenticated user account still exists before applying profile changes.
    const user = await this.databaseService.user.findUnique({
      where: { id: currentUser.userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User account was not found');
    }

    // updateMe route:
    // Persist the trimmed profile fields that were provided and return the updated public profile payload.
    const updatedUser = await this.databaseService.user.update({
      where: { id: currentUser.userId },
      data: {
        ...(payload.firstName ? { firstName: payload.firstName.trim() } : {}),
        ...(payload.lastName ? { lastName: payload.lastName.trim() } : {}),
      },
    });

    return {
      message: 'Profile updated successfully',
      user: this.toPublicUser(updatedUser),
    };
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
    // toPublicUser helper:
    // Strip internal fields and return the public profile shape shared across user-facing endpoints.
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
