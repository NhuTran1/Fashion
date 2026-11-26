import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

// Đọc cấu hình HTTP từ .env ở root và các biến môi trường của tiến trình.
export function loadApiConfig(): { host: string; port: number } {
  const envPath = resolve(__dirname, '../../../.env');
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }

  return parseApiConfig(process.env);
}

export function parseApiConfig(env: NodeJS.ProcessEnv): {
  host: string;
  port: number;
} {
  const host = env.APP_HOST ?? '127.0.0.1';
  if (!isIP(host)) {
    throw new Error('APP_HOST must be an IPv4 or IPv6 address.');
  }

  const portText = env.APP_PORT ?? '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || port < 1 || port > 65535) {
    throw new Error('APP_PORT must be an integer from 1 to 65535.');
  }

  return { host, port };
}
