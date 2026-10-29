import { Routes } from '@angular/router';

export const perfilRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./perfil/perfil').then((m) => m.Perfil),
  },
];
