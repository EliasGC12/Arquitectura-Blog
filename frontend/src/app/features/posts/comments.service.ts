import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';

const POSTS_URL = 'http://127.0.0.1:8001/api/posts/';
const COMMENTS_URL = 'http://127.0.0.1:8001/api/comments/';

export interface CommentAuthor {
  id: number;
  username: string;
  rol?: string;
  profile_picture?: string | null;
}

export interface Comment {
  id: number;
  post: number;
  author: CommentAuthor;
  content: string;
  is_approved: boolean;
  created_at: string;
  parent: number | null;
  reply_to: string | null;
  likes_count: number;
  liked_by_me: boolean;
}

export interface OwnedComment extends Comment {
  post_titulo: string;
}

@Service()
export class CommentService {
  private readonly http = inject(HttpClient);

  getComments(postId: number): Observable<Comment[]> {
    return this.http
      .get<Comment[] | { results: Comment[] }>(`${POSTS_URL}${postId}/comments/`)
      .pipe(map((data) => (Array.isArray(data) ? data : data.results)));
  }

  createComment(postId: number, content: string, parent?: number | null): Observable<Comment> {
    const body: { content: string; parent?: number } = { content };
    if (parent) {
      body.parent = parent;
    }
    return this.http.post<Comment>(`${POSTS_URL}${postId}/comments/`, body);
  }

  getInbox(): Observable<OwnedComment[]> {
    return this.http
      .get<OwnedComment[] | { results: OwnedComment[] }>(`${COMMENTS_URL}inbox/`)
      .pipe(map((data) => (Array.isArray(data) ? data : data.results)));
  }

  approveComment(id: number, isApproved = true): Observable<Comment> {
    return this.http.patch<Comment>(`${COMMENTS_URL}${id}/approve/`, { is_approved: isApproved });
  }

  rejectComment(id: number, message: string): Observable<void> {
    return this.http.post<void>(`${COMMENTS_URL}${id}/reject/`, { message });
  }

  getPending(): Observable<OwnedComment[]> {
    return this.http
      .get<OwnedComment[] | { results: OwnedComment[] }>(`${COMMENTS_URL}pending/`)
      .pipe(map((data) => (Array.isArray(data) ? data : data.results)));
  }

  likeComment(id: number): Observable<{ id: number; liked: boolean; likes_count: number }> {
    return this.http.post<{ id: number; liked: boolean; likes_count: number }>(
      `${COMMENTS_URL}${id}/like/`,
      {},
    );
  }

  getOwnComments(): Observable<OwnedComment[]> {
    return this.http.get<OwnedComment[]>(`${COMMENTS_URL}mine/`);
  }
}
