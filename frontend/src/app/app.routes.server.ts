import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Client,
  },
  {
    path: 'perfil',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth',
    renderMode: RenderMode.Client,
  },
  {
    path: 'posts',
    renderMode: RenderMode.Client,
  },
  {
    path: 'posts/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'registros',
    renderMode: RenderMode.Client,
  },
  {
    path: 'revision',
    renderMode: RenderMode.Client,
  },
  {
    path: 'mis-comentarios',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
