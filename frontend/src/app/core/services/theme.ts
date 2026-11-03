import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, Service, signal } from '@angular/core';

export const THEME_STORAGE_KEY = 'blog_fcc_theme';
export const MODE_STORAGE_KEY = 'blog_fcc_mode';
export const ACCENT_STORAGE_KEY = 'blog_fcc_accent';

export const ACCENTS = [
  { id: 'azul', label: 'Azul', swatch: '#1d4ed8' },
  { id: 'rojo', label: 'Rojo', swatch: '#b91c1c' },
  { id: 'morado', label: 'Morado', swatch: '#6d28d9' },
  { id: 'verde', label: 'Verde', swatch: '#15803d' },
  { id: 'esmeralda', label: 'Esmeralda', swatch: '#047857' },
  { id: 'naranja', label: 'Naranja', swatch: '#c2410c' },
] as const;

export const MODES = [
  { id: 'claro', label: 'Modo claro' },
  { id: 'oscuro', label: 'Modo oscuro' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
export type ModeId = (typeof MODES)[number]['id'];

const LEGACY_ACCENTS: Record<string, AccentId> = {
  azul: 'azul',
  morado: 'morado',
  rojo: 'rojo',
  oscuro: 'azul',
};

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  readonly accent = signal<AccentId>(this.readAccent());
  readonly mode = signal<ModeId>(this.readMode());

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.commit();
    }
  }

  setAccent(accent: AccentId): void {
    if (!ACCENTS.some((item) => item.id === accent)) {
      return;
    }
    this.accent.set(accent);
    this.commit();
  }

  setMode(mode: ModeId): void {
    if (mode !== 'claro' && mode !== 'oscuro') {
      return;
    }
    this.mode.set(mode);
    this.commit();
  }

  toggleMode(): void {
    this.setMode(this.mode() === 'oscuro' ? 'claro' : 'oscuro');
  }

  private readAccent(): AccentId {
    if (!isPlatformBrowser(this.platformId)) {
      return 'azul';
    }
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (ACCENTS.some((item) => item.id === saved)) {
      return saved as AccentId;
    }
    const legacy = localStorage.getItem(THEME_STORAGE_KEY);
    return legacy && LEGACY_ACCENTS[legacy] ? LEGACY_ACCENTS[legacy] : 'azul';
  }

  private readMode(): ModeId {
    if (!isPlatformBrowser(this.platformId)) {
      return 'claro';
    }
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === 'claro' || saved === 'oscuro') {
      return saved;
    }
    return localStorage.getItem(THEME_STORAGE_KEY) === 'oscuro' ? 'oscuro' : 'claro';
  }

  private commit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(ACCENT_STORAGE_KEY, this.accent());
    localStorage.setItem(MODE_STORAGE_KEY, this.mode());
    this.apply();
  }

  private apply(): void {
    const root = this.document.documentElement;
    if (!root) {
      return;
    }
    root.dataset['accent'] = this.accent();
    root.dataset['mode'] = this.mode();
    delete root.dataset['theme'];
  }
}
