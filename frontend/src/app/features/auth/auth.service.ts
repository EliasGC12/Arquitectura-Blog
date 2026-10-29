import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { TokenStorage } from '../../core/services/token-storage';
import { environment } from '../../../environments/environment';

export interface AuthTokens {
  access: string;
  refresh: string;
}

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorage);

  login(username: string, password: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${environment.apiUrl}token/`, { username, password })
      .pipe(tap((tokens) => this.tokenStorage.save(tokens.access, tokens.refresh)));
  }

  register(payload: FormData): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}usuarios/registro/`, payload);
  }
}
