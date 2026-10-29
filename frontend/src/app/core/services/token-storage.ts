import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service } from '@angular/core';

import { THEME_STORAGE_KEY } from './theme';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

@Service()
export class TokenStorage {
  private readonly platformId = inject(PLATFORM_ID);

  getAccessToken(): string | null {
    return this.read(ACCESS_TOKEN_KEY);
  }

  getValidAccessToken(): string | null {
    const token = this.getAccessToken();
    if (!token) {
      return null;
    }
    if (this.isAccessTokenValid(token)) {
      return token;
    }

    this.remove(ACCESS_TOKEN_KEY);
    return null;
  }

  isAccessTokenValid(token: string): boolean {
    const payload = this.readPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  }

  save(access: string, refresh: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }

  clear(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    localStorage.clear();
    if (theme) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }

  private read(key: string): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return localStorage.getItem(key);
  }

  private remove(key: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(key);
  }

  private readPayload(token: string): { exp?: number } | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
      return JSON.parse(json) as { exp?: number };
    } catch {
      return null;
    }
  }
}
