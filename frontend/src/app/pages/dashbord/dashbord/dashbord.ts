import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiKeyService, ApiKeyResponse } from '../../../services/API_KEY/service.api-key';
import { AutnServices } from '../../../services/auth/autn.services';

@Component({
  selector: 'app-dashbord',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashbord.html',
  styles: ``,
})
export class Dashbord implements OnInit {
  apiKey = signal<string | null>(null);
  apiKeyResponse = signal<ApiKeyResponse | null>(null);
  isLoading = signal<boolean>(false);

  constructor(private authService: AutnServices, private apiKeyService: ApiKeyService) {}

  get user() {
    return this.authService.getUser();
  }

  onGenerateKey() {
    this.isLoading.set(true);
    this.apiKeyService.generateApiKey().subscribe({
      next: (response) => {
        this.apiKey.set(response.apiKey.key);
        this.apiKeyResponse.set({ apiKey: null, hasKey: true });
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error generating API key:', error);
        this.isLoading.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.isLoading.set(true);
    this.apiKeyService.getMyApiKey().subscribe({
      next: (response) => {
        this.apiKeyResponse.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error fetching API key:', error);
        this.isLoading.set(false);
      }
    });
  }
  copyToClipboard() {
    const key = this.apiKey() || '';
    navigator.clipboard.writeText(key);
  }

  onRevokeKey() {
    this.isLoading.set(true);
    this.apiKeyService.revokeApiKey().subscribe({
      next: () => {
        this.apiKey.set(null);
        this.apiKeyResponse.set({ apiKey: null, hasKey: false });
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error revoking API key:', error);
        this.isLoading.set(false);
      }
    });
  }
}
