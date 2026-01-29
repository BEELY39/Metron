import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AutnServices } from '../services/auth/autn.services';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AutnServices);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
