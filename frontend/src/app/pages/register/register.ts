import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AutnServices } from '../../services/auth/autn.services';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styles: ``,
})
export class Register {
private fb = inject(FormBuilder)
private autnServices = inject(AutnServices)
private router = inject(Router)

registerForm: FormGroup = this.fb.group({
  fullName: ['', [Validators.required, Validators.minLength(2)]],
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
})
onSubmit(){
  if(this.registerForm.valid){
    this.autnServices.register(this.registerForm.value).subscribe({
      next: (response) => {
        console.log(response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.log(error);
      }
    })
  }
}

}
