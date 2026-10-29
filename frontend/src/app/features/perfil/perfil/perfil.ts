import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TokenStorage } from '../../../core/services/token-storage';
import { RejectDialog } from '../../../shared/components/reject-dialog/reject-dialog';
import { roleLabel } from '../../../shared/roles';
import { environment } from '../../../../environments/environment';
import { OwnedComment, CommentService } from '../../posts/comments.service';
import { Post, PostsService } from '../../posts/posts.service';
import { RichContent } from '../../posts/rich-content/rich-content';
import { StyledTitle } from '../../posts/styled-title/styled-title';
import { timeAgo } from '../../posts/time-ago';

interface PerfilUsuario {
  username: string;
  email: string;
  rol: string;
  bio: string;
  profile_picture: string | null;
  cover_color: string;
  cover_image: string | null;
}

type ProfileTab = 'posts' | 'notices';
type ProfilePanel = 'account' | 'public' | null;

const PRESET_AVATARS = [
  { style: 'avataaars', seed: 'Luna' },
  { style: 'avataaars', seed: 'Marco' },
  { style: 'avataaars', seed: 'Sofia' },
  { style: 'avataaars', seed: 'Andres' },
  { style: 'bottts', seed: 'Nova' },
  { style: 'bottts', seed: 'Pixel' },
  { style: 'bottts', seed: 'Orbit' },
  { style: 'bottts', seed: 'Bolt' },
  { style: 'lorelei', seed: 'Valeria' },
  { style: 'lorelei', seed: 'Hugo' },
  { style: 'fun-emoji', seed: 'Sol' },
  { style: 'fun-emoji', seed: 'Rio' },
] as const;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, RichContent, RejectDialog, StyledTitle],
  selector: 'app-perfil',
  styleUrl: './perfil.css',
  templateUrl: './perfil.html',
})
export class Perfil implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorage);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly postsService = inject(PostsService);
  private readonly commentService = inject(CommentService);
  private avatarUrl: string | null = null;
  private coverUrl: string | null = null;
  private avatarFile: File | null = null;
  private coverFile: File | null = null;

  protected readonly presetAvatars = PRESET_AVATARS;
  protected readonly selectedAvatar = signal('');
  protected readonly perfil = signal<PerfilUsuario | null>(null);
  protected readonly myPosts = signal<Post[]>([]);
  protected readonly notices = signal<OwnedComment[]>([]);
  protected readonly tab = signal<ProfileTab>('posts');
  protected readonly panel = signal<ProfilePanel>(null);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly listError = signal('');
  protected readonly submitting = signal(false);
  protected readonly picturePreview = signal<string | null>(null);
  protected readonly coverPreview = signal<string | null>(null);
  protected readonly clearCover = signal(false);
  protected readonly coverDirty = signal(false);
  protected readonly replyOpen = signal<number | null>(null);
  protected readonly replyBusy = signal<number | null>(null);
  protected readonly replyNote = signal('');
  protected readonly sentReplies = signal<Record<number, string>>({});
  protected readonly replyDrafts = signal<Record<number, string>>({});
  protected readonly timeAgo = timeAgo;
  protected readonly roleLabel = roleLabel;
  protected readonly moderatingCommentId = signal<number | null>(null);
  protected readonly rejectTarget = signal<OwnedComment | null>(null);

  protected readonly accountForm = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
  });

  protected readonly publicForm = this.formBuilder.nonNullable.group({
    bio: [''],
    cover_color: ['#1b4f9c'],
  });

  ngOnInit(): void {
    if (!this.tokenStorage.getValidAccessToken()) {
      void this.router.navigate(['/auth']);
      return;
    }

    this.http
      .get<PerfilUsuario>(`${environment.apiUrl}usuarios/perfil/`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (perfil) => {
          this.showPerfil(perfil);
          this.loadPosts();
          this.loadNotices();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            error.status === 401
              ? 'La sesión no es válida. Vuelve a iniciar sesión.'
              : 'No se pudo cargar el perfil.',
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.revoke(this.avatarUrl);
    this.revoke(this.coverUrl);
  }

  protected initial(): string {
    return this.perfil()?.username.trim().charAt(0).toUpperCase() || '?';
  }

  protected shownCover(): string | null {
    if (this.coverPreview()) {
      return this.coverPreview();
    }
    if (this.clearCover()) {
      return null;
    }
    return this.perfil()?.cover_image ?? null;
  }

  protected coverColor(): string {
    return this.publicForm.controls.cover_color.value || this.perfil()?.cover_color || '#1b4f9c';
  }

  protected togglePanel(panel: Exclude<ProfilePanel, null>): void {
    this.successMessage.set('');
    this.errorMessage.set('');
    this.panel.set(this.panel() === panel ? null : panel);
  }

  protected avatarSrc(style: string, seed: string): string {
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
  }

  protected pickAvatar(style: string, seed: string): void {
    if (this.submitting()) {
      return;
    }

    const previousPreview = this.picturePreview();
    const previousKey = this.selectedAvatar();
    this.selectedAvatar.set(`${style}:${seed}`);
    this.picturePreview.set(this.avatarSrc(style, seed));
    const data = new FormData();
    data.append('avatar_style', style);
    data.append('avatar_seed', seed);
    this.patch(data, 'Avatar actualizado.', () => {
      this.picturePreview.set(previousPreview);
      this.selectedAvatar.set(previousKey);
    });
  }

  protected onAvatar(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.avatarFile = file;
    this.selectedAvatar.set('');
    this.revoke(this.avatarUrl);
    this.avatarUrl = null;
    if (!file) {
      this.picturePreview.set(this.perfil()?.profile_picture ?? null);
      return;
    }
    this.avatarUrl = URL.createObjectURL(file);
    this.picturePreview.set(this.avatarUrl);
  }

  protected onCover(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.coverFile = file;
    this.revoke(this.coverUrl);
    this.coverUrl = null;
    if (!file) {
      this.coverDirty.set(false);
      this.coverPreview.set(null);
      return;
    }
    this.clearCover.set(false);
    this.coverDirty.set(true);
    this.coverUrl = URL.createObjectURL(file);
    this.coverPreview.set(this.coverUrl);
  }

  protected removeCover(): void {
    this.coverFile = null;
    this.coverDirty.set(false);
    this.clearCover.set(true);
    this.revoke(this.coverUrl);
    this.coverUrl = null;
    this.coverPreview.set(null);
  }

  protected saveAccount(): void {
    if (this.accountForm.invalid || this.submitting()) {
      this.accountForm.markAllAsTouched();
      this.errorMessage.set('Escribe un nombre de usuario.');
      return;
    }

    const data = new FormData();
    data.append('username', this.accountForm.controls.username.value);
    if (this.avatarFile) {
      data.append('profile_picture', this.avatarFile);
    }
    this.patch(data, 'Perfil actualizado.');
  }

  protected savePublic(): void {
    if (this.submitting()) {
      return;
    }

    const data = new FormData();
    data.append('bio', this.publicForm.controls.bio.value);
    data.append('cover_color', this.publicForm.controls.cover_color.value);
    if (this.coverFile) {
      data.append('cover_image', this.coverFile);
    } else if (this.clearCover()) {
      data.append('clear_cover', 'true');
    }
    this.patch(data, 'Información pública actualizada.');
  }

  protected saveCover(): void {
    if (!this.coverFile || this.submitting()) {
      return;
    }

    const data = new FormData();
    data.append('cover_image', this.coverFile);
    data.append('cover_color', this.publicForm.controls.cover_color.value);
    this.patch(data, 'Portada actualizada.');
  }

  protected logout(): void {
    this.tokenStorage.clear();
    void this.router.navigate(['/auth']);
  }

  protected setReply(id: number, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.replyDrafts.update((drafts) => ({ ...drafts, [id]: value }));
  }

  protected canModerate(): boolean {
    const rol = this.perfil()?.rol;
    return rol === 'EDITOR' || rol === 'SUPERVISOR' || rol === 'ADMIN';
  }

  protected approveNotice(item: OwnedComment): void {
    if (this.moderatingCommentId() !== null) {
      return;
    }
    this.moderatingCommentId.set(item.id);
    this.replyNote.set('');
    this.commentService
      .approveComment(item.id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.moderatingCommentId.set(null);
          this.notices.update((items) =>
            items.map((entry) => (entry.id === saved.id ? { ...entry, is_approved: true } : entry)),
          );
          this.replyNote.set('Comentario aprobado.');
        },
        error: () => {
          this.moderatingCommentId.set(null);
          this.replyNote.set('No se pudo aprobar el comentario.');
        },
      });
  }

  protected askRejectNotice(item: OwnedComment): void {
    this.rejectTarget.set(item);
  }

  protected confirmReject(message: string): void {
    const item = this.rejectTarget();
    if (!item || this.moderatingCommentId() !== null) {
      return;
    }
    this.rejectTarget.set(null);
    this.moderatingCommentId.set(item.id);
    this.replyNote.set('');
    this.commentService
      .rejectComment(item.id, message)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.moderatingCommentId.set(null);
          this.notices.update((items) => items.filter((entry) => entry.id !== item.id));
          this.replyNote.set('Comentario rechazado.');
        },
        error: () => {
          this.moderatingCommentId.set(null);
          this.replyNote.set('No se pudo rechazar el comentario.');
        },
      });
  }

  protected reply(item: OwnedComment, event: Event): void {
    event.preventDefault();
    const content = (this.replyDrafts()[item.id] ?? '').trim();
    if (!content || this.replyBusy() !== null) {
      return;
    }

    this.replyBusy.set(item.id);
    this.replyNote.set('');
    this.commentService
      .createComment(item.post, content, item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.replyBusy.set(null);
          this.replyOpen.set(null);
          this.replyDrafts.update((drafts) => ({ ...drafts, [item.id]: '' }));
          this.sentReplies.update((sent) => ({ ...sent, [item.id]: content }));
          this.replyNote.set('Respuesta publicada.');
          this.loadNotices();
        },
        error: () => {
          this.replyBusy.set(null);
          this.replyNote.set('No se pudo enviar la respuesta.');
        },
      });
  }

  private loadPosts(): void {
    this.postsService
      .getMyPosts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posts) => this.myPosts.set(posts),
        error: () => this.listError.set('No se pudieron cargar tus publicaciones.'),
      });
  }

  private loadNotices(): void {
    this.commentService
      .getInbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comments) => this.notices.set(comments),
        error: () => this.listError.set('No se pudieron cargar las notificaciones.'),
      });
  }

  private patch(data: FormData, success: string, onError?: () => void): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.submitting.set(true);
    this.http
      .patch<PerfilUsuario>(`${environment.apiUrl}usuarios/perfil/`, data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (perfil) => {
          this.submitting.set(false);
          this.avatarFile = null;
          this.coverFile = null;
          this.clearCover.set(false);
          this.coverDirty.set(false);
          this.showPerfil(perfil);
          this.panel.set(null);
          this.successMessage.set(success);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          onError?.();
          this.errorMessage.set(this.readError(error));
        },
      });
  }

  private showPerfil(perfil: PerfilUsuario): void {
    this.perfil.set(perfil);
    this.accountForm.setValue({ username: perfil.username });
    this.publicForm.setValue({
      bio: perfil.bio ?? '',
      cover_color: perfil.cover_color || '#1b4f9c',
    });
    this.revoke(this.avatarUrl);
    this.revoke(this.coverUrl);
    this.avatarUrl = null;
    this.coverUrl = null;
    this.picturePreview.set(perfil.profile_picture);
    this.coverPreview.set(null);
  }

  private revoke(url: string | null): void {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private readError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'La sesión no es válida. Vuelve a iniciar sesión.';
    }

    const data: unknown = error.error;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      for (const key of ['username', 'cover_color', 'cover_image', 'profile_picture', 'avatar_seed', 'avatar_style']) {
        const message = record[key];
        if (Array.isArray(message) && typeof message[0] === 'string') {
          return key === 'profile_picture' || key === 'cover_image'
            ? 'Selecciona un archivo de imagen válido.'
            : message[0];
        }
      }
    }

    return 'No se pudo actualizar el perfil.';
  }
}
