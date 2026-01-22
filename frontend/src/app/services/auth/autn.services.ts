import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment.development';
import { Observable, tap, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AutnServices {
  private http = inject(HttpClient);
  private readonly API_URL = environment.api;
  private platformId = inject(PLATFORM_ID);

  register(userData: { fullName: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/register`, userData);
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API_URL}/login`, credentials).pipe(
      tap((response: any) => {
        if (isPlatformBrowser(this.platformId) && response.token) {
          localStorage.setItem('auth_token', response.token.value);
          localStorage.setItem('user', JSON.stringify(response.user));
        }
      })
    );
  }

  logout(): Observable<any> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(null);
    }
    // Nettoyer le localStorage immédiatement pour permettre la déconnexion côté client
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');

    return this.http.post(`${this.API_URL}/logout`, {});
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem('auth_token');
  }

  getUser(): any {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return !!this.getToken();
  }
}
