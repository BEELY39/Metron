import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class ApiKeyService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly API_URL = environment.api;

  private getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem('auth_token');
  }

  private getAuthHeaders(): HttpHeaders | null {
    const token = this.getToken();
    if (!token) return null;
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  /**
   * Récupère la clé API de l'utilisateur (une seule par compte)
   */
  getMyApiKey(): Observable<ApiKeyResponse> {
    const headers = this.getAuthHeaders();
    if (!headers) return of({ error: 'Non authentifié' } as any);
    return this.http.get<ApiKeyResponse>(`${this.API_URL}/api-keys/me`, { headers });
  }

  /**
   * Génère une clé API (une seule autorisée par compte)
   * Si une clé existe déjà, retourne une erreur
   */
  generateApiKey(): Observable<ApiKeyCreateResponse> {
    const headers = this.getAuthHeaders();
    if (!headers) return of({ error: 'Non authentifié' } as any);
    return this.http.post<ApiKeyCreateResponse>(`${this.API_URL}/api-keys/generate`, {}, { headers });
  }

  /**
   * Révoque la clé API existante
   */
  revokeApiKey(): Observable<any> {
    const headers = this.getAuthHeaders();
    if (!headers) return of({ error: 'Non authentifié' });
    return this.http.delete(`${this.API_URL}/api-keys/revoke`, { headers });
  }

  /**
   * Génère une facture Factur-X
   */
  generateFacturX(file: File, invoiceData: InvoiceData, apiKey: string): Observable<Blob> {
    const formData = new FormData();
    formData.append('pdf', file);

    // Champs obligatoires
    formData.append('invoiceNumber', invoiceData.invoiceNumber);
    formData.append('invoiceDate', invoiceData.invoiceDate);
    formData.append('sellerName', invoiceData.sellerName);
    formData.append('sellerSiret', invoiceData.sellerSiret);
    formData.append('buyerName', invoiceData.buyerName);
    formData.append('currencyCode', invoiceData.currencyCode);
    formData.append('totalHT', invoiceData.totalHT);
    formData.append('totalTVA', invoiceData.totalTVA);
    formData.append('totalTTC', invoiceData.totalTTC);

    // Champs optionnels
    if (invoiceData.invoiceTypeCode) formData.append('invoiceTypeCode', invoiceData.invoiceTypeCode);
    if (invoiceData.sellerVatNumber) formData.append('sellerVatNumber', invoiceData.sellerVatNumber);
    if (invoiceData.buyerSiret) formData.append('buyerSiret', invoiceData.buyerSiret);
    if (invoiceData.buyerVatNumber) formData.append('buyerVatNumber', invoiceData.buyerVatNumber);
    if (invoiceData.paymentTerms) formData.append('paymentTerms', invoiceData.paymentTerms);
    if (invoiceData.paymentDueDate) formData.append('paymentDueDate', invoiceData.paymentDueDate);
    if (invoiceData.purchaseOrderReference) formData.append('purchaseOrderReference', invoiceData.purchaseOrderReference);

    // Adresses
    if (invoiceData.sellerAddress) {
      if (invoiceData.sellerAddress.street) formData.append('sellerAddress[street]', invoiceData.sellerAddress.street);
      if (invoiceData.sellerAddress.zipCode) formData.append('sellerAddress[zipCode]', invoiceData.sellerAddress.zipCode);
      if (invoiceData.sellerAddress.city) formData.append('sellerAddress[city]', invoiceData.sellerAddress.city);
      formData.append('sellerAddress[countryCode]', invoiceData.sellerAddress.countryCode);
    }

    if (invoiceData.buyerAddress) {
      if (invoiceData.buyerAddress.street) formData.append('buyerAddress[street]', invoiceData.buyerAddress.street);
      if (invoiceData.buyerAddress.zipCode) formData.append('buyerAddress[zipCode]', invoiceData.buyerAddress.zipCode);
      if (invoiceData.buyerAddress.city) formData.append('buyerAddress[city]', invoiceData.buyerAddress.city);
      formData.append('buyerAddress[countryCode]', invoiceData.buyerAddress.countryCode);
    }

    // Lignes de facture
    if (invoiceData.lines && invoiceData.lines.length > 0) {
      invoiceData.lines.forEach((line, index) => {
        formData.append(`lines[${index}][description]`, line.description);
        formData.append(`lines[${index}][quantity]`, line.quantity);
        formData.append(`lines[${index}][unitPrice]`, line.unitPrice);
        formData.append(`lines[${index}][vatRate]`, line.vatRate);
        formData.append(`lines[${index}][totalHT]`, line.totalHT);
      });
    }

    const headers = new HttpHeaders().set('X-API-Key', apiKey);

    return this.http.post(`${this.API_URL.replace('/auth', '')}/invoices/facturx`, formData, {
      headers,
      responseType: 'blob'
    });
  }
}

// Interfaces
export interface ApiKey {
  id: number;
  keyPrefix: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

export interface ApiKeyResponse {
  apiKey: ApiKey | null;
  hasKey: boolean;
}

export interface ApiKeyCreateResponse {
  apiKey: {
    key: string; // Clé complète (visible une seule fois)
    keyPrefix: string;
  };
  message: string;
}

export interface Address {
  street?: string;
  zipCode?: string;
  city?: string;
  countryCode: string;
}

export interface InvoiceLine {
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  totalHT: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTypeCode?: '380' | '381';
  sellerName: string;
  sellerSiret: string;
  sellerVatNumber?: string;
  sellerAddress: Address;
  buyerName: string;
  buyerSiret?: string;
  buyerVatNumber?: string;
  buyerAddress: Address;
  currencyCode: string;
  totalHT: string;
  totalTVA: string;
  totalTTC: string;
  lines?: InvoiceLine[];
  paymentTerms?: string;
  paymentDueDate?: string;
  purchaseOrderReference?: string;
}
