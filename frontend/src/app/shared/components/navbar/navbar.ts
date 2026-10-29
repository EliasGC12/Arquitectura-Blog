import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import { Api } from '../../../core/services/api';
import { AppNotification, NotificationsService } from '../../../core/services/notifications';
import { ThemeId, THEMES, ThemeService } from '../../../core/services/theme';
import { TokenStorage } from '../../../core/services/token-storage';
import { timeAgo } from '../../../features/posts/time-ago';

const MODERATOR_ROLES = ['EDITOR', 'SUPERVISOR', 'ADMIN'];
const AUTHOR_ROLES = ['AUTOR', 'EDITOR', 'SUPERVISOR', 'ADMIN'];

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-navbar',
  styleUrl: './navbar.css',
  templateUrl: './navbar.html',
})
export class Navbar implements OnInit {
  private readonly api = inject(Api);
  private readonly notifications = inject(NotificationsService);
  private readonly tokenStorage = inject(TokenStorage);
  protected readonly theme = inject(ThemeService);
  protected readonly themes = THEMES;
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadedToken: string | null = null;

  protected readonly loggedIn = signal(false);
  protected readonly canReview = signal(false);
  protected readonly canManageUsers = signal(false);
  protected readonly canSeeOwnComments = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly bellOpen = signal(false);
  protected readonly unreadCount = signal(0);
  protected readonly notices = signal<AppNotification[]>([]);
  protected readonly timeAgo = timeAgo;

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.menuOpen.set(false);
        this.bellOpen.set(false);
        this.refreshRole();
        this.loadNotifications();
      });
    this.refreshRole();
    this.loadNotifications();
  }

  protected toggleBell(): void {
    const next = !this.bellOpen();
    this.bellOpen.set(next);
    if (next) {
      this.loadNotifications();
    }
  }

  protected noticeText(item: AppNotification): string {
    if (item.notification_type === 'POST_REJECTED') {
      return `Publicación rechazada: ${item.message}`;
    }
    if (item.notification_type === 'COMMENT_REJECTED') {
      return `Comentario rechazado: ${item.message}`;
    }
    return item.message;
  }

  protected openNotice(item: AppNotification): void {
    this.bellOpen.set(false);
    this.menuOpen.set(false);
    if (!item.is_read) {
      this.notifications
        .markRead(item.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.loadNotifications(),
        });
    }
    if (item.related_post) {
      void this.router.navigate(['/posts', item.related_post]);
    }
  }

  protected onTheme(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (this.themes.some((item) => item.id === value)) {
      this.theme.set(value as ThemeId);
    }
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected logout(): void {
    this.tokenStorage.clear();
    this.loadedToken = null;
    this.loggedIn.set(false);
    this.canReview.set(false);
    this.canManageUsers.set(false);
    this.canSeeOwnComments.set(false);
    this.menuOpen.set(false);
    this.bellOpen.set(false);
    this.unreadCount.set(0);
    this.notices.set([]);
    void this.router.navigate(['/auth']);
  }

  private refreshRole(): void {
    const token = this.tokenStorage.getValidAccessToken();
    this.loggedIn.set(token !== null);
    if (!token) {
      this.loadedToken = null;
      this.canReview.set(false);
      this.canManageUsers.set(false);
      this.canSeeOwnComments.set(false);
      this.unreadCount.set(0);
      this.notices.set([]);
      this.bellOpen.set(false);
      return;
    }

    if (token === this.loadedToken) {
      return;
    }

    this.loadedToken = token;
    this.api
      .get<{ rol: string }>('usuarios/perfil/')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (perfil) => {
          this.canReview.set(MODERATOR_ROLES.includes(perfil.rol));
          this.canManageUsers.set(perfil.rol === 'ADMIN' || perfil.rol === 'SUPERVISOR');
          this.canSeeOwnComments.set(AUTHOR_ROLES.includes(perfil.rol));
        },
        error: () => {
          this.loadedToken = null;
          this.canReview.set(false);
          this.canManageUsers.set(false);
          this.canSeeOwnComments.set(false);
        },
      });
  }

  private loadNotifications(): void {
    if (!this.tokenStorage.getValidAccessToken()) {
      this.unreadCount.set(0);
      this.notices.set([]);
      return;
    }

    this.notifications
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.unreadCount.set(page.unread_count);
          this.notices.set(page.results);
        },
        error: () => {
          this.unreadCount.set(0);
        },
      });
  }
}
