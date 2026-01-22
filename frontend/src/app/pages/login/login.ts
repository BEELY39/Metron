import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AutnServices } from '../../services/auth/autn.services';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AutnServices);
  private router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  errorMessage = '';

  onSubmit() {
    if (this.loginForm.valid) {
      this.errorMessage = '';
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          console.log('Login success:', response);
          this.router.navigate(['/']);
        },
        error: (error) => {
          console.error('Login error:', error);
          this.errorMessage = error.error?.error || 'Email ou mot de passe incorrect';
        },
      });
    }
  }
}
