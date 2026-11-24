import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NATIVE_TOKEN_KEY = 'soi_atelier_opaque_session_token';

/**
 * Platform-aware session store following ADR-0003:
 * - Native (Android/iOS): stores opaque bearer token inside Expo SecureStore.
 * - Web: never persists session tokens in localStorage/sessionStorage; keeps mock cookie
 *   handle and CSRF token strictly in memory while real backend uses HttpOnly cookie.
 */
class SessionStore {
  private inMemoryToken: string | null = null;
  private inMemoryCsrf: string | null = null;

  /** Persist a session token according to ADR-0003 platform rules. */
  async saveSession(token: string, csrfToken?: string): Promise<void> {
    this.inMemoryToken = token;
    this.inMemoryCsrf = csrfToken ?? null;
    if (Platform.OS !== 'web') {
      try {
        await SecureStore.setItemAsync(NATIVE_TOKEN_KEY, token);
      } catch {
        // Fallback silently to in-memory if SecureStore is unavailable on simulator.
      }
    }
  }

  /** Update only the in-memory Web CSRF token (used by GET /auth/csrf after reload). */
  setCsrfToken(csrfToken: string | null): void {
    this.inMemoryCsrf = csrfToken;
  }

  /** Retrieve the current bearer or mock cookie token. */
  async getToken(): Promise<string | null> {
    if (this.inMemoryToken) {
      return this.inMemoryToken;
    }
    if (Platform.OS !== 'web') {
      try {
        const stored = await SecureStore.getItemAsync(NATIVE_TOKEN_KEY);
        this.inMemoryToken = stored;
        return stored;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Read the current in-memory CSRF token for Web write requests. */
  getCsrfToken(): string | null {
    return this.inMemoryCsrf;
  }

  /** Clear all stored session and CSRF credentials on logout or 401 expiry. */
  async clear(): Promise<void> {
    this.inMemoryToken = null;
    this.inMemoryCsrf = null;
    if (Platform.OS !== 'web') {
      try {
        await SecureStore.deleteItemAsync(NATIVE_TOKEN_KEY);
      } catch {
        // Ignore SecureStore cleanup failures.
      }
    }
  }
}

export const sessionStore = new SessionStore();
