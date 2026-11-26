import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// ESLint dùng bộ quy tắc khuyến nghị cho mã TypeScript của NestJS.
export default defineConfig(globalIgnores(['dist/', 'src/generated/prisma/']), {
  files: ['src/**/*.ts'],
  extends: [js.configs.recommended, tseslint.configs.recommended],
});
