import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AutnServices } from '../../services/auth/autn.services';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private authService = inject(AutnServices);
  user : any = null;
  isloggedIn: boolean= false;

  ngOnInit() :void {
    this.refreshUser();
  }

  refreshUser() :void {
    this.isloggedIn = this.authService.isAuthenticated();
    this.user = this.authService.getUser();
  }

  logout() :void {
    this.authService.logout().subscribe(() => {
      this.refreshUser();
    });
  }
}
