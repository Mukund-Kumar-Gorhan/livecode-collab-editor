import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or server directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  clientOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  runnerUrl: string;
}

export const config: AppConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.SERVER_PORT || '5000', 10),
  host: process.env.SERVER_HOST || '0.0.0.0',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  runnerUrl: process.env.RUNNER_URL || 'http://localhost:4000',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/collab_editor?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_key_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_change_me',
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
};

