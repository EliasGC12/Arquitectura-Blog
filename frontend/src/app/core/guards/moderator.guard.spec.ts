import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';

import { moderatorGuard } from './moderator.guard';

function accessToken(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `eyJhbGciOiJub25lIn0.${payload}.sig`;
}

describe('moderatorGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('sends an anonymous visitor to login', () => {
    const outcome = TestBed.runInInjectionContext(() => moderatorGuard({} as never, {} as never));

    expect(outcome).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(outcome as UrlTree)).toBe('/auth');
  });

  it('blocks readers and authors from revision', async () => {
    localStorage.setItem('access_token', accessToken());
    const http = TestBed.inject(HttpTestingController);

    for (const rol of ['LECTOR', 'AUTOR']) {
      const outcome = TestBed.runInInjectionContext(() => moderatorGuard({} as never, {} as never));
      if (!isObservable(outcome)) {
        throw new Error('El guard debía consultar el perfil.');
      }
      const pending = firstValueFrom(outcome);
      http.expectOne('http://127.0.0.1:8001/api/usuarios/perfil/').flush({ rol });
      const value = await pending;

      expect(value).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(value as UrlTree)).toBe('/posts');
    }

    http.verify();
  });

  it('allows an editor into revision', async () => {
    localStorage.setItem('access_token', accessToken());
    const http = TestBed.inject(HttpTestingController);
    const outcome = TestBed.runInInjectionContext(() => moderatorGuard({} as never, {} as never));
    if (!isObservable(outcome)) {
      throw new Error('El guard debía consultar el perfil.');
    }
    const pending = firstValueFrom(outcome);
    http.expectOne('http://127.0.0.1:8001/api/usuarios/perfil/').flush({ rol: 'EDITOR' });

    expect(await pending).toBe(true);
    http.verify();
  });
});
