import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { Api } from '../services/api';
import { TokenStorage } from '../services/token-storage';

const AUTHOR_ROLES = ['AUTOR', 'EDITOR', 'SUPERVISOR', 'ADMIN'];

export const authorGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!inject(TokenStorage).getValidAccessToken()) {
    return router.createUrlTree(['/auth']);
  }

  return inject(Api)
    .get<{ rol: string }>('usuarios/perfil/')
    .pipe(
      map((perfil) =>
        AUTHOR_ROLES.includes(perfil.rol) ? true : router.createUrlTree(['/posts']),
      ),
      catchError(() => of(router.createUrlTree(['/auth']))),
    );
};
