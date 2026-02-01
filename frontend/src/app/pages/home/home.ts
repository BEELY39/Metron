import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AutnServices } from '../../services/auth/autn.services';
import { PaymentService } from '../../services/payment/payment.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private paymentService = inject(PaymentService);
  private authService = inject(AutnServices);
  private router = inject(Router);
  user: any = null;
  isloggedIn = false;

  upgradeToPro(): void {
    if (!this.isloggedIn){
      this.router.navigate(['/register'])
      return
    }
    this.paymentService.redirectToCheckout()
  }

  ngOnInit(): void {
    this.refreshUser();
  }

  refreshUser(): void {
    this.isloggedIn = this.authService.isAuthenticated();
    this.user = this.authService.getUser();
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.refreshUser();
        this.router.navigate(['/']);
      },
      error: () => {
        // Même en cas d'erreur API, on déconnecte côté client
        this.refreshUser();
      }
    });
  }
}
