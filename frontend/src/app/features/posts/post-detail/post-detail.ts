import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Api } from '../../../core/services/api';
import { TokenStorage } from '../../../core/services/token-storage';
import { Comment, CommentService } from '../comments.service';
import { CommentThread } from '../comment-thread/comment-thread';
import { PostMedia } from '../post-media/post-media';
import { Post, PostsService } from '../posts.service';
import { RichContent } from '../rich-content/rich-content';
import { StyledTitle } from '../styled-title/styled-title';
import { timeAgo } from '../time-ago';
import { RejectDialog } from '../../../shared/components/reject-dialog/reject-dialog';
import { MediaImage, MediaUrlPipe } from '../../../shared/media/media';
import { roleLabel } from '../../../shared/roles';

interface PerfilUsuario {
  username: string;
  rol: string;
}

@Component({
  imports: [RouterLink, PostMedia, RichContent, RejectDialog, StyledTitle, CommentThread, MediaImage, MediaUrlPipe],
  selector: 'app-post-detail',
  styleUrl: './post-detail.css',
  templateUrl: './post-detail.html',
})
export class PostDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly postsService = inject(PostsService);
  private readonly commentService = inject(CommentService);
  private readonly api = inject(Api);
  private readonly tokenStorage = inject(TokenStorage);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly post = signal<Post | null>(null);
  protected readonly authenticated = signal(false);
  protected readonly canModerate = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly commentError = signal('');
  protected readonly commentNote = signal('');
  protected readonly draft = signal('');
  protected readonly submitting = signal(false);
  protected readonly approvingId = signal<number | null>(null);
  protected readonly replyOpen = signal<number | null>(null);
  protected readonly replyDrafts = signal<Record<number, string>>({});
  protected readonly rejectTarget = signal<Comment | null>(null);
  protected readonly timeAgo = timeAgo;
  protected readonly roleLabel = roleLabel;

  ngOnInit(): void {
    this.authenticated.set(this.tokenStorage.getAccessToken() !== null);
    if (this.authenticated()) {
      this.api
        .get<PerfilUsuario>('usuarios/perfil/')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (perfil) => {
            this.canModerate.set(
              perfil.rol === 'EDITOR' || perfil.rol === 'SUPERVISOR' || perfil.rol === 'ADMIN',
            );
          },
        });
    }

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isInteger(id)) {
        this.errorMessage.set('No se encontró la publicación.');
        return;
      }
      this.loadPost(id);
    });
  }

  protected textareaValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected appendComment(comment: Comment): void {
    this.commentNote.set('');
    this.post.update((item) =>
      item
        ? {
            ...item,
            comments: [...item.comments.filter((entry) => entry.id !== comment.id), comment],
          }
        : item,
    );
  }

  protected submitComment(event: Event): void {
    event.preventDefault();
    const current = this.post();
    const content = this.draft().trim();
    if (!current) {
      return;
    }
    if (!content) {
      this.commentError.set('Escribe un comentario.');
      return;
    }
    if (this.submitting()) {
      return;
    }

    this.commentError.set('');
    this.commentNote.set('');
    this.submitting.set(true);
    this.commentService
      .createComment(current.id, content)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comment) => {
          this.submitting.set(false);
          this.draft.set('');
          this.appendComment(comment);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.commentError.set(this.readCommentError(error));
        },
      });
  }

  protected approve(comment: Comment): void {
    const current = this.post();
    if (!current || this.approvingId() !== null) {
      return;
    }

    this.approvingId.set(comment.id);
    this.commentError.set('');
    this.commentService
      .approveComment(comment.id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.approvingId.set(null);
          this.post.update((item) =>
            item
              ? {
                  ...item,
                  comments: item.comments.map((entry) => (entry.id === saved.id ? saved : entry)),
                }
              : item,
          );
        },
        error: () => {
          this.approvingId.set(null);
          this.commentError.set('No se pudo aprobar el comentario.');
        },
      });
  }

  protected askReject(comment: Comment): void {
    this.rejectTarget.set(comment);
  }

  protected confirmReject(message: string): void {
    const comment = this.rejectTarget();
    const current = this.post();
    if (!comment || !current || this.approvingId() !== null) {
      return;
    }

    this.rejectTarget.set(null);
    this.approvingId.set(comment.id);
    this.commentError.set('');
    this.commentService
      .rejectComment(comment.id, message)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.approvingId.set(null);
          this.post.update((item) =>
            item
              ? { ...item, comments: item.comments.filter((entry) => entry.id !== comment.id) }
              : item,
          );
        },
        error: () => {
          this.approvingId.set(null);
          this.commentError.set('No se pudo rechazar el comentario.');
        },
      });
  }

  protected toggleReply(commentId: number): void {
    this.replyOpen.set(this.replyOpen() === commentId ? null : commentId);
  }

  protected setReplyDraft(commentId: number, value: string): void {
    this.replyDrafts.update((state) => ({ ...state, [commentId]: value }));
  }

  protected submitReply(comment: Comment, event: Event): void {
    event.preventDefault();
    const current = this.post();
    const content = (this.replyDrafts()[comment.id] ?? '').trim();
    if (!current) {
      return;
    }
    if (!content) {
      this.commentError.set('Escribe una respuesta.');
      return;
    }
    if (this.submitting()) {
      return;
    }

    this.commentError.set('');
    this.commentNote.set('');
    this.submitting.set(true);
    this.commentService
      .createComment(current.id, content, comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.submitting.set(false);
          this.replyOpen.set(null);
          this.replyDrafts.update((state) => ({ ...state, [comment.id]: '' }));
          this.appendComment(saved);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.commentError.set(this.readCommentError(error));
        },
      });
  }

  private loadPost(id: number): void {
    this.postsService
      .getPost(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.errorMessage.set('');
          this.post.set(post);
        },
        error: () => {
          this.post.set(null);
          this.errorMessage.set('No se encontró la publicación.');
        },
      });
  }

  private readCommentError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Inicia sesión para comentar.';
    }
    if (error.status === 403) {
      return 'No tienes permiso para comentar.';
    }
    if (error.status === 400) {
      return 'Escribe un comentario antes de enviarlo.';
    }
    return 'No se pudo publicar el comentario. Inténtalo de nuevo.';
  }
}
