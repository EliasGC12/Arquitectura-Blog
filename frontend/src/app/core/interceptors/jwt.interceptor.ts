import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { TokenStorage } from '../services/token-storage';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(TokenStorage).getValidAccessToken();
  if (!token || !req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
