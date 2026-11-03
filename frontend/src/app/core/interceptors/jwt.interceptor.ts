import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, shareReplay, switchMap, tap, throwError } from 'rxjs';

import { apiBase } from '../api-url';
import { TokenStorage } from '../services/token-storage';

let refreshInFlight: Observable<string> | null = null;

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorage);
  const router = inject(Router);
  const backend = inject(HttpBackend);
  const access = tokens.getValidAccessToken();
  const authed =
    access && req.url.startsWith(apiBase())
      ? req.clone({ setHeaders: { Authorization: `Bearer ${access}` } })
      : req;

  return next(authed).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !canRefresh(req.url)) {
        return throwError(() => error);
      }

      if (req.headers.has('X-Retry')) {
        endSession(tokens, router);
        return throwError(() => error);
      }

      const refresh = tokens.getRefreshToken();
      if (!refresh) {
        return throwError(() => error);
      }

      return refreshAccess(backend, tokens, refresh).pipe(
        catchError((refreshError: unknown) => {
          endSession(tokens, router);
          return throwError(() => refreshError);
        }),
        switchMap((nextAccess) =>
          next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${nextAccess}`,
                'X-Retry': '1',
              },
            }),
          ).pipe(
            catchError((retryError: unknown) => {
              if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
                endSession(tokens, router);
              }
              return throwError(() => retryError);
            }),
          ),
        ),
      );
    }),
  );
};

function canRefresh(url: string): boolean {
  return url.startsWith(apiBase()) && !url.includes('/token/');
}

function refreshAccess(backend: HttpBackend, tokens: TokenStorage, refresh: string): Observable<string> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const http = new HttpClient(backend);
  refreshInFlight = http
    .post<{ access: string; refresh?: string }>(`${apiBase()}token/refresh/`, { refresh })
    .pipe(
      tap((body) => tokens.save(body.access, body.refresh ?? refresh)),
      map((body) => body.access),
      finalize(() => {
        refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  return refreshInFlight;
}

function endSession(tokens: TokenStorage, router: Router): void {
  tokens.clear();
  void router.navigateByUrl('/auth');
}
