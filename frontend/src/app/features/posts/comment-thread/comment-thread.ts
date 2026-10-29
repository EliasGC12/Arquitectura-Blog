import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { roleLabel } from '../../../shared/roles';
import { Comment, CommentService } from '../comments.service';
import { timeAgo } from '../time-ago';

interface CommentNode {
  comment: Comment;
  replies: CommentNode[];
}

interface LikeState {
  liked: boolean;
  count: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  selector: 'app-comment-thread',
  styleUrl: './comment-thread.css',
  templateUrl: './comment-thread.html',
})
export class CommentThread {
  private readonly commentsApi = inject(CommentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly comments = input<Comment[]>([]);
  readonly postId = input.required<number>();
  readonly authenticated = input(false);
  readonly canModerate = input(false);
  readonly approvingId = input<number | null>(null);

  readonly approve = output<Comment>();
  readonly reject = output<Comment>();
  readonly posted = output<Comment>();
  readonly noted = output<string>();
  readonly failed = output<string>();

  protected readonly timeAgo = timeAgo;
  protected readonly roleLabel = roleLabel;
  protected readonly replyOpen = signal<number | null>(null);
  protected readonly replyDrafts = signal<Record<number, string>>({});
  protected readonly replyBusy = signal<number | null>(null);
  private readonly likes = signal<Record<number, LikeState>>({});

  protected readonly tree = computed(() => commentTree(this.comments()));

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected likeOf(comment: Comment): LikeState {
    return this.likes()[comment.id] ?? { liked: comment.liked_by_me, count: comment.likes_count };
  }

  protected toggleReply(commentId: number): void {
    if (!this.authenticated()) {
      this.failed.emit('Inicia sesión para responder.');
      return;
    }
    this.replyOpen.set(this.replyOpen() === commentId ? null : commentId);
  }

  protected setReply(commentId: number, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.replyDrafts.update((state) => ({ ...state, [commentId]: value }));
  }

  protected sendReply(comment: Comment, event: Event): void {
    event.preventDefault();
    const content = (this.replyDrafts()[comment.id] ?? '').trim();
    if (!content || this.replyBusy() !== null) {
      if (!content) {
        this.failed.emit('Escribe una respuesta.');
      }
      return;
    }

    this.replyBusy.set(comment.id);
    this.commentsApi
      .createComment(this.postId(), content, comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.replyBusy.set(null);
          this.replyOpen.set(null);
          this.replyDrafts.update((state) => ({ ...state, [comment.id]: '' }));
          this.posted.emit(saved);
        },
        error: (error: HttpErrorResponse) => {
          this.replyBusy.set(null);
          this.failed.emit(this.readError(error));
        },
      });
  }

  protected toggleLike(comment: Comment): void {
    if (!this.authenticated()) {
      this.failed.emit('Inicia sesión para indicar que te gusta.');
      return;
    }
    const current = this.likeOf(comment);
    this.commentsApi
      .likeComment(comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.likes.update((state) => ({
            ...state,
            [comment.id]: { liked: result.liked, count: result.likes_count },
          }));
        },
        error: () => {
          this.likes.update((state) => ({ ...state, [comment.id]: current }));
          this.failed.emit('No se pudo registrar el me gusta.');
        },
      });
  }

  private readError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Inicia sesión para responder.';
    }
    if (error.status === 400) {
      return 'Escribe una respuesta antes de enviarla.';
    }
    return 'No se pudo enviar la respuesta.';
  }
}

function commentTree(comments: Comment[]): CommentNode[] {
  const ids = new Set(comments.map((comment) => comment.id));
  const byParent = new Map<number | null, Comment[]>();
  for (const comment of comments) {
    const parent = comment.parent !== null && ids.has(comment.parent) ? comment.parent : null;
    const group = byParent.get(parent) ?? [];
    group.push(comment);
    byParent.set(parent, group);
  }

  const build = (parent: number | null): CommentNode[] =>
    (byParent.get(parent) ?? []).map((comment) => ({
      comment,
      replies: build(comment.id),
    }));

  return build(null);
}
