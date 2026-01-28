import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InvoiceService, InvoiceData } from '../../services/invoice/invoice';
import { AutnServices } from '../../services/auth/autn.services';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private invoiceService = inject(InvoiceService);
  private authService = inject(AutnServices);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID);

  user: any = null;
  apiKeys: any[] = [];
  selectedApiKey: string = '';
  manualApiKey: string = '';
  newApiKeyName: string = '';
  newlyCreatedKey: string = '';
  keyCopied: boolean = false;

  selectedFile: File | null = null;
  isDragOver = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  invoiceForm: FormGroup = this.fb.group({
    invoiceNumber: ['', Validators.required],
    invoiceDate: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    sellerName: ['', Validators.required],
    sellerSiret: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
    sellerVatNumber: [''],
    sellerStreet: [''],
    sellerZipCode: [''],
    sellerCity: [''],
    sellerCountryCode: ['FR', Validators.required],
    buyerName: ['', Validators.required],
    buyerSiret: [''],
    buyerVatNumber: [''],
    buyerStreet: [''],
    buyerZipCode: [''],
    buyerCity: [''],
    buyerCountryCode: ['FR', Validators.required],
    currencyCode: ['EUR', Validators.required],
    totalHT: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    totalTVA: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    totalTTC: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    paymentTerms: [''],
    paymentDueDate: [''],
  });

  ngOnInit(): void {
    this.user = this.authService.getUser();
    this.loadApiKeys();
    this.setDefaultDate();
  }

  setDefaultDate(): void {
    const today = new Date().toISOString().split('T')[0];
    this.invoiceForm.patchValue({ invoiceDate: today });
  }

  loadApiKeys(): void {
    this.invoiceService.listApiKeys().subscribe({
      next: (response) => {
        this.apiKeys = response.apiKeys || [];
        if (this.apiKeys.length > 0) {
          this.selectedApiKey = this.apiKeys[0].keyPrefix;
        }
      },
      error: (error) => {
        console.error('Error loading API keys:', error);
      }
    });
  }

  createApiKey(): void {
    if (!this.newApiKeyName.trim()) {
      this.errorMessage = 'Veuillez entrer un nom pour la clé API';
      return;
    }

    this.invoiceService.createApiKey(this.newApiKeyName).subscribe({
      next: (response) => {
        this.newlyCreatedKey = response.apiKey.key;
        this.keyCopied = false;
        this.successMessage = '';
        this.newApiKeyName = '';
        this.loadApiKeys();
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Erreur lors de la création de la clé API';
      }
    });
  }

  copyApiKey(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    navigator.clipboard.writeText(this.newlyCreatedKey).then(() => {
      this.keyCopied = true;
    });
  }

  dismissNewKey(): void {
    this.newlyCreatedKey = '';
    this.keyCopied = false;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    if (file.type !== 'application/pdf') {
      this.errorMessage = 'Seuls les fichiers PDF sont acceptés';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Le fichier ne doit pas dépasser 5 Mo';
      return;
    }
    this.selectedFile = file;
    this.errorMessage = '';
  }

  removeFile(): void {
    this.selectedFile = null;
  }

  generateFacturX(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.selectedFile) {
      this.errorMessage = 'Veuillez sélectionner un fichier PDF';
      return;
    }

    if (!this.manualApiKey && !this.newlyCreatedKey) {
      this.errorMessage = 'Veuillez entrer votre clé API ou en créer une nouvelle';
      return;
    }

    if (this.invoiceForm.invalid) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    const formValue = this.invoiceForm.value;
    const invoiceData: InvoiceData = {
      invoiceNumber: formValue.invoiceNumber,
      invoiceDate: formValue.invoiceDate,
      sellerName: formValue.sellerName,
      sellerSiret: formValue.sellerSiret,
      sellerVatNumber: formValue.sellerVatNumber || undefined,
      sellerAddress: {
        street: formValue.sellerStreet || undefined,
        zipCode: formValue.sellerZipCode || undefined,
        city: formValue.sellerCity || undefined,
        countryCode: formValue.sellerCountryCode,
      },
      buyerName: formValue.buyerName,
      buyerSiret: formValue.buyerSiret || undefined,
      buyerVatNumber: formValue.buyerVatNumber || undefined,
      buyerAddress: {
        street: formValue.buyerStreet || undefined,
        zipCode: formValue.buyerZipCode || undefined,
        city: formValue.buyerCity || undefined,
        countryCode: formValue.buyerCountryCode,
      },
      currencyCode: formValue.currencyCode,
      totalHT: formValue.totalHT,
      totalTVA: formValue.totalTVA,
      totalTTC: formValue.totalTTC,
      paymentTerms: formValue.paymentTerms || undefined,
      paymentDueDate: formValue.paymentDueDate || undefined,
    };

    const fullApiKey = this.manualApiKey || this.newlyCreatedKey;

    this.isLoading = true;

    this.invoiceService.generateFacturX(this.selectedFile, invoiceData, fullApiKey).subscribe({
      next: (blob) => {
        this.isLoading = false;
        this.downloadFile(blob);
        this.successMessage = 'Facture Factur-X générée avec succès !';
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error || 'Erreur lors de la génération de la facture';
      }
    });
  }

  downloadFile(blob: Blob): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture-facturx-${this.invoiceForm.value.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      window.location.href = '/';
    });
  }
}
