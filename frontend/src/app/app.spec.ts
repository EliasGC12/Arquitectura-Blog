import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { ACCENT_STORAGE_KEY, MODE_STORAGE_KEY, THEME_STORAGE_KEY, ThemeService } from './core/services/theme';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(MODE_STORAGE_KEY);
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    document.documentElement.dataset['mode'] = 'claro';
    document.documentElement.dataset['accent'] = 'azul';
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the logo and the appearance controls', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand img')?.getAttribute('alt')).toBe('BLOG FCC');
    const labels = [...compiled.querySelectorAll('[role="radio"]')].map((item) =>
      item.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Azul', 'Rojo', 'Morado', 'Verde', 'Esmeralda', 'Naranja']);
    expect(compiled.querySelector('button.mode')?.getAttribute('aria-label')).toBe('Activar modo oscuro');
  });

  it('should switch accent and mode without breaking the navbar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const theme = TestBed.inject(ThemeService);

    for (const id of ['morado', 'rojo', 'verde', 'esmeralda', 'naranja', 'azul']) {
      const radio = root.querySelector(`[data-accent="${id}"]`) as HTMLButtonElement;
      radio.click();
      await fixture.whenStable();
      expect(theme.accent()).toBe(id);
      expect(document.documentElement.dataset['accent']).toBe(id);
      expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe(id);
      expect(root.querySelector('header')).toBeTruthy();
    }

    const mode = root.querySelector('button.mode') as HTMLButtonElement;
    mode.click();
    await fixture.whenStable();
    expect(theme.mode()).toBe('oscuro');
    expect(document.documentElement.dataset['mode']).toBe('oscuro');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('oscuro');
    expect(root.querySelector('header')).toBeTruthy();

    mode.click();
    await fixture.whenStable();
    expect(theme.mode()).toBe('claro');
    expect(document.documentElement.dataset['mode']).toBe('claro');
  });
});
