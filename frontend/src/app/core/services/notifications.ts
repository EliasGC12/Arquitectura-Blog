import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

import { Api } from './api';

export interface AppNotification {
  id: number;
  notification_type:
    | 'POST_APPROVED'
    | 'POST_REJECTED'
    | 'COMMENT_REJECTED'
    | 'NEW_COMMENT'
    | 'COMMENT_REPLY';
  message: string;
  is_read: boolean;
  created_at: string;
  related_post: number | null;
  sender: string | null;
}

export interface NotificationPage {
  unread_count: number;
  results: AppNotification[];
}

@Service()
export class NotificationsService {
  private readonly api = inject(Api);

  list(): Observable<NotificationPage> {
    return this.api.get<NotificationPage>('notifications/');
  }

  markRead(id: number): Observable<AppNotification> {
    return this.api.patch<AppNotification>(`notifications/${id}/read/`, {});
  }
}
