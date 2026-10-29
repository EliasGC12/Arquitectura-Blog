import { Routes } from '@angular/router';

export const postsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./post-list/post-list').then((m) => m.PostList),
  },
  {
    path: ':id',
    loadComponent: () => import('./post-detail/post-detail').then((m) => m.PostDetail),
  },
];
