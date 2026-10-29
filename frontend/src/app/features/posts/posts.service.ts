import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';

import { Comment } from './comments.service';

const API_URL = 'http://127.0.0.1:8001/api/';
const POSTS_URL = `${API_URL}posts/`;

export interface Category {
  id: number;
  nombre: string;
  slug: string;
}

export interface Tag {
  id: number;
  nombre: string;
  slug: string;
}

export interface PostAutor {
  id: number;
  username: string;
  rol: string;
  profile_picture: string | null;
}

export interface Post {
  id: number;
  titulo: string;
  titulo_font: string;
  titulo_color: string;
  titulo_bold: boolean;
  titulo_italic: boolean;
  contenido: string;
  autor: PostAutor;
  category: Category | null;
  tags: Tag[];
  image: string | null;
  video_url: string | null;
  estado: 'BORRADOR' | 'PENDIENTE_REVISION' | 'PUBLICADO' | 'ARCHIVADO';
  fecha_creacion: string;
  fecha_actualizacion: string;
  comments: Comment[];
}

export interface PaginatedPosts {
  count: number;
  next: string | null;
  previous: string | null;
  results: Post[];
}

export interface PostData {
  titulo?: string;
  titulo_font?: string;
  titulo_color?: string;
  titulo_bold?: boolean;
  titulo_italic?: boolean;
  contenido?: string;
  estado?: Post['estado'];
  category_id?: number | null;
  category_name?: string;
  tag_ids?: number[];
  tag_names?: string[];
  video_url?: string | null;
}

export interface PostFormValue {
  titulo: string;
  titulo_font?: string;
  titulo_color?: string;
  titulo_bold?: boolean;
  titulo_italic?: boolean;
  contenido: string;
  estado: Post['estado'];
  category_id: number | null;
  category_name: string;
  tag_ids: number[];
  tag_names: string;
  video_url: string;
}

export function toPostData(value: PostFormValue): PostData {
  const data: PostData = {
    titulo: value.titulo.trim(),
    contenido: value.contenido,
    estado: value.estado,
    tag_ids: value.tag_ids ?? [],
    video_url: value.video_url.trim(),
  };
  const categoryName = value.category_name.trim();
  if (categoryName) {
    data.category_name = categoryName;
  } else {
    data.category_id = value.category_id;
  }

  const tagNames = value.tag_names
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (tagNames.length > 0) {
    data.tag_names = tagNames;
  }
  if (value.titulo_font !== undefined) {
    data.titulo_font = value.titulo_font;
  }
  if (value.titulo_color !== undefined) {
    data.titulo_color = value.titulo_color;
  }
  if (value.titulo_bold !== undefined) {
    data.titulo_bold = value.titulo_bold;
  }
  if (value.titulo_italic !== undefined) {
    data.titulo_italic = value.titulo_italic;
  }
  return data;
}

@Service()
export class PostsService {
  private readonly http = inject(HttpClient);

  getPosts(url: string | null = null): Observable<PaginatedPosts> {
    return this.http.get<PaginatedPosts>(url ?? POSTS_URL);
  }

  getMyPosts(): Observable<Post[]> {
    return this.http
      .get<Post[] | PaginatedPosts>(`${POSTS_URL}?mine=1`)
      .pipe(map((data) => (Array.isArray(data) ? data : data.results)));
  }

  pendingReviewUrl(): string {
    return `${POSTS_URL}?status=PENDIENTE_REVISION`;
  }

  getPost(id: number): Observable<Post> {
    return this.http.get<Post>(`${POSTS_URL}${id}/`);
  }

  getCategories(): Observable<Category[]> {
    return this.http
      .get<Category[] | { results: Category[] }>(`${API_URL}categories/`)
      .pipe(map((data) => (Array.isArray(data) ? data : data.results)));
  }

  getTags(): Observable<Tag[]> {
    return this.http
      .get<Tag[] | { results: Tag[] }>(`${API_URL}tags/`)
      .pipe(map((data) => (Array.isArray(data) ? data : data.results)));
  }

  createPost(postData: PostData, image?: File | null): Observable<Post> {
    const body = image ? this.toFormData(postData, image) : postData;
    return this.http.post<Post>(POSTS_URL, body);
  }

  updatePost(id: number, data: Partial<PostData>, image?: File | null): Observable<Post> {
    const url = `${POSTS_URL}${id}/`;
    if (!image) {
      return this.http.patch<Post>(url, data);
    }

    return this.http.patch<Post>(url, this.toFormData(data, image)).pipe(
      switchMap((post) => {
        if ((data.tag_ids?.length ?? 0) === 0 && !(data.tag_names?.length)) {
          return this.http.patch<Post>(url, { tag_ids: [] });
        }
        return of(post);
      }),
    );
  }

  private toFormData(data: Partial<PostData>, image: File): FormData {
    const form = new FormData();
    const append = (key: string, value: string) => form.append(key, value);
    if (data.titulo !== undefined) {
      append('titulo', data.titulo);
    }
    if (data.titulo_font !== undefined) {
      append('titulo_font', data.titulo_font);
    }
    if (data.titulo_color !== undefined) {
      append('titulo_color', data.titulo_color);
    }
    if (data.titulo_bold !== undefined) {
      append('titulo_bold', data.titulo_bold ? 'true' : 'false');
    }
    if (data.titulo_italic !== undefined) {
      append('titulo_italic', data.titulo_italic ? 'true' : 'false');
    }
    if (data.contenido !== undefined) {
      append('contenido', data.contenido);
    }
    if (data.estado) {
      append('estado', data.estado);
    }
    if (data.category_name) {
      append('category_name', data.category_name);
    } else if (data.category_id != null) {
      append('category_id', String(data.category_id));
    }
    for (const id of data.tag_ids ?? []) {
      append('tag_ids', String(id));
    }
    for (const name of data.tag_names ?? []) {
      append('tag_names', name);
    }
    if (data.video_url !== undefined) {
      append('video_url', data.video_url ?? '');
    }
    form.append('image', image);
    return form;
  }

  approvePost(id: number): Observable<Post> {
    return this.http.post<Post>(`${POSTS_URL}${id}/approve/`, {});
  }

  rejectPost(id: number, message: string): Observable<Post> {
    return this.http.post<Post>(`${POSTS_URL}${id}/reject/`, { message });
  }

  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${POSTS_URL}${id}/`);
  }
}
