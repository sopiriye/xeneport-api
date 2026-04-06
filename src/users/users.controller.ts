import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current investor profile',
    description:
      'Returns the authenticated investor profile. Requires a bearer access token.',
  })
  @ApiOkResponse({
    description: 'Authenticated profile returned successfully.',
    schema: {
      example: {
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
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  getMe(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.getMe(currentUser);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current investor profile',
    description:
      'Updates the authenticated investor profile. Email is intentionally immutable.',
  })
  @ApiOkResponse({
    description: 'Profile updated successfully.',
    schema: {
      example: {
        message: 'Profile updated successfully',
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
          updatedAt: '2026-03-30T10:20:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  updateMe(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(currentUser, payload);
  }
}
