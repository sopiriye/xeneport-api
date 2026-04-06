import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './types/authenticated-user.interface';

interface JwtPayload {
  sub: string;
  email: string;
  sid: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();
    const authorizationHeader =
      request.headers.authorization ?? request.headers.Authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException('Bearer token is required');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const session = await this.databaseService.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        status: 'active',
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session is not active');
    }

    if (session.expiresAt <= new Date()) {
      await this.databaseService.authSession.update({
        where: { id: session.id },
        data: {
          status: 'expired',
          revokedAt: new Date(),
        },
      });

      throw new UnauthorizedException('Session has expired');
    }

    await this.databaseService.authSession.update({
      where: { id: session.id },
      data: {
        lastUsedAt: new Date(),
      },
    });

    request.user = {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sid,
    };

    return true;
  }
}
