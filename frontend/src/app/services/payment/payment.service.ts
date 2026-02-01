import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment.development';
import { Observable } from 'rxjs';

export interface SubscriptionStatus {
  plan: 'free' | 'pro' | 'enterprise';
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  invoicesUsedThisMonth: number;
  quotaLimit: number;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.api.replace('/api/auth', '/api');

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  createCheckoutSession(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(
      `${this.API_URL}/payments/checkout`,
      {},
      { headers: this.getHeaders() }
    );
  }

  createPortal(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(
      `${this.API_URL}/payments/portal`,
      {},
      { headers: this.getHeaders() }
    );
  }

  getSubscription(): Observable<SubscriptionStatus> {
    return this.http.get<SubscriptionStatus>(
      `${this.API_URL}/payments/subscription`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Redirige vers Stripe Checkout pour l'abonnement Pro
   */
  redirectToCheckout(): void {
    this.createCheckoutSession().subscribe({
      next: (response) => {
        window.location.href = response.url;
      },
      error: (err) => {
        console.error('Erreur checkout:', err);
      }
    });
  }

  /**
   * Redirige vers le portail Stripe pour gérer l'abonnement
   */
  redirectToPortal(): void {
    this.createPortal().subscribe({
      next: (response) => {
        window.location.href = response.url;
      },
      error: (err) => {
        console.error('Erreur portail:', err);
      }
    });
  }
}
