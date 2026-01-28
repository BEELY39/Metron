import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment.development';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly API_URL = environment.api;

  private getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem('auth_token');
  }

  createApiKey(name: string): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return of({ error: 'Non authentifié' });
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post(`${this.API_URL}/api-keys`, { name }, { headers });
  }

  listApiKeys(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return of({ error: 'Non authentifié' });
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get(`${this.API_URL}/api-keys`, { headers });
  }

  generateFacturX(file: File, invoiceData: InvoiceData, apiKey: string): Observable<Blob> {
    const formData = new FormData();
    formData.append('pdf', file);

    // Ajouter les champs simples
    formData.append('invoiceNumber', invoiceData.invoiceNumber);
    formData.append('invoiceDate', invoiceData.invoiceDate);
    formData.append('sellerName', invoiceData.sellerName);
    formData.append('sellerSiret', invoiceData.sellerSiret);
    formData.append('buyerName', invoiceData.buyerName);
    formData.append('currencyCode', invoiceData.currencyCode);
    formData.append('totalHT', invoiceData.totalHT);
    formData.append('totalTVA', invoiceData.totalTVA);
    formData.append('totalTTC', invoiceData.totalTTC);

    // Champs optionnels simples
    if (invoiceData.invoiceTypeCode) formData.append('invoiceTypeCode', invoiceData.invoiceTypeCode);
    if (invoiceData.sellerVatNumber) formData.append('sellerVatNumber', invoiceData.sellerVatNumber);
    if (invoiceData.buyerSiret) formData.append('buyerSiret', invoiceData.buyerSiret);
    if (invoiceData.buyerVatNumber) formData.append('buyerVatNumber', invoiceData.buyerVatNumber);
    if (invoiceData.paymentTerms) formData.append('paymentTerms', invoiceData.paymentTerms);
    if (invoiceData.paymentDueDate) formData.append('paymentDueDate', invoiceData.paymentDueDate);
    if (invoiceData.purchaseOrderReference) formData.append('purchaseOrderReference', invoiceData.purchaseOrderReference);

    // Adresses - format clé[sous-clé] pour multipart
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

    // Lignes de facture (si présentes)
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
