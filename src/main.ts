// import 'dotenv/config'; // this is required to be removed for render deployment, as render does not support environment variables in this way. Instead, render injects env vars at runtime, so we can rely on process.env directly without needing to load from a .env file.
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  //still yet to review{
  const allowedOrigins = (
    process.env.CORS_ORIGINS ??
    [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ].join(',')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    // origin: (origin, callback) => {
    //   if (
    //     !origin ||
    //     allowedOrigins.includes('*') ||
    //     allowedOrigins.includes(origin)
    //   ) {
    //     callback(null, true);
    //     return;
    //   }

    //   callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    // },
    origin: true, // Allow all origins (for development only, consider restricting in production)
    credentials: true,
  });
  // end }
  app.setGlobalPrefix('api', {
    exclude: [
      {
        path: 'upload-prices',
        method: RequestMethod.POST,
      },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Portfolio Drift Monitor API')
    .setDescription(
      'Authentication, profile, portfolio, holdings, price, drift, and alert APIs for the Portfolio Drift Monitor MVP.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

(async () => {
  await bootstrap();
})().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
