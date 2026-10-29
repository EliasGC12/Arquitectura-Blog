import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { TokenStorage } from '../services/token-storage';

export const authGuard: CanActivateFn = () => {
  if (inject(TokenStorage).getValidAccessToken()) {
    return true;
  }

  return inject(Router).createUrlTree(['/auth']);
};

export const entryGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (inject(TokenStorage).getValidAccessToken()) {
    return router.createUrlTree(['/posts']);
  }

  return router.createUrlTree(['/auth']);
};
