import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service, signal } from '@angular/core';

export const THEME_STORAGE_KEY = 'blog_fcc_theme';

export const THEMES = [
  { id: 'azul', label: 'Azul Clásico' },
  { id: 'morado', label: 'Morado Elegante' },
  { id: 'rojo', label: 'Rojo Carmesí' },
  { id: 'oscuro', label: 'Modo Oscuro' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  readonly current = signal<ThemeId>(this.read());

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.apply(this.current());
    }
  }

  set(theme: ThemeId): void {
    this.current.set(theme);
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    this.apply(theme);
  }

  private read(): ThemeId {
    if (!isPlatformBrowser(this.platformId)) {
      return 'azul';
    }

    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.some((item) => item.id === saved) ? (saved as ThemeId) : 'azul';
  }

  private apply(theme: ThemeId): void {
    const root = this.document.documentElement;
    if (!root) {
      return;
    }
    root.dataset['theme'] = theme;
  }
}
