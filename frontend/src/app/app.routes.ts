import { Routes } from '@angular/router';

import { adminGuard } from './core/guards/admin.guard';
import { authorGuard } from './core/guards/author.guard';
import { authGuard, entryGuard } from './core/guards/auth.guard';
import { moderatorGuard } from './core/guards/moderator.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [entryGuard], children: [] },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'posts',
    loadChildren: () => import('./features/posts/posts.routes').then((m) => m.postsRoutes),
  },
  {
    path: 'registros',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/usuarios/registros/registros').then((m) => m.Registros),
  },
  {
    path: 'revision',
    canActivate: [moderatorGuard],
    loadComponent: () => import('./features/posts/revision/revision').then((m) => m.Revision),
  },
  {
    path: 'mis-comentarios',
    canActivate: [authorGuard],
    loadComponent: () =>
      import('./features/posts/my-comments/my-comments').then((m) => m.MyComments),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadChildren: () => import('./features/perfil/perfil.routes').then((m) => m.perfilRoutes),
  },
];
