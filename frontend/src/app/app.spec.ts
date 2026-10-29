import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { THEME_STORAGE_KEY, ThemeService } from './core/services/theme';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.dataset['theme'] = 'azul';
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the logo and the theme selector', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand img')?.getAttribute('alt')).toBe('BLOG FCC');
    const select = compiled.querySelector('select[aria-label="Tema visual"]') as HTMLSelectElement;
    const labels = [...select.options].map((option) => option.text);
    expect(labels).toEqual(['Azul Clásico', 'Morado Elegante', 'Rojo Carmesí', 'Modo Oscuro']);
  });

  it('should switch themes without breaking the navbar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Tema visual"]',
    ) as HTMLSelectElement;
    const theme = TestBed.inject(ThemeService);

    for (const id of ['morado', 'rojo', 'oscuro', 'azul']) {
      select.value = id;
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(theme.current()).toBe(id);
      expect(document.documentElement.dataset['theme']).toBe(id);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(id);
      expect(fixture.nativeElement.querySelector('header')).toBeTruthy();
    }
  });
});
