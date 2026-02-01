import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentService, SubscriptionStatus } from './payment.service';
import { environment } from '../../../environments/environment.development';

describe('PaymentService', () => {
  let service: PaymentService;
  let httpMock: HttpTestingController;
  const API_URL = environment.api;

  beforeEach(() => {
    localStorage.setItem('auth_token', 'test-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(PaymentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createCheckoutSession', () => {
    it('should POST to /payments/checkout with auth header', () => {
      const mockResponse = { url: 'https://checkout.stripe.com/session123' };

      service.createCheckoutSession().subscribe(response => {
        expect(response.url).toBe(mockResponse.url);
      });

      const req = httpMock.expectOne(`${API_URL}/payments/checkout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(mockResponse);
    });
  });

  describe('createPortal', () => {
    it('should POST to /payments/portal with auth header', () => {
      const mockResponse = { url: 'https://billing.stripe.com/portal123' };

      service.createPortal().subscribe(response => {
        expect(response.url).toBe(mockResponse.url);
      });

      const req = httpMock.expectOne(`${API_URL}/payments/portal`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(mockResponse);
    });
  });

  describe('getSubscription', () => {
    it('should GET /payments/subscription and return status', () => {
      const mockStatus: SubscriptionStatus = {
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: '2026-02-28T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        invoicesUsedThisMonth: 150,
        quotaLimit: 10000
      };

      service.getSubscription().subscribe(status => {
        expect(status.plan).toBe('pro');
        expect(status.status).toBe('active');
        expect(status.quotaLimit).toBe(10000);
      });

      const req = httpMock.expectOne(`${API_URL}/payments/subscription`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(mockStatus);
    });

    it('should return free plan status', () => {
      const mockStatus: SubscriptionStatus = {
        plan: 'free',
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        invoicesUsedThisMonth: 1,
        quotaLimit: 1
      };

      service.getSubscription().subscribe(status => {
        expect(status.plan).toBe('free');
        expect(status.quotaLimit).toBe(1);
      });

      const req = httpMock.expectOne(`${API_URL}/payments/subscription`);
      req.flush(mockStatus);
    });
  });

  describe('redirectToCheckout', () => {
    it('should call createCheckoutSession and redirect on success', () => {
      const mockUrl = 'https://checkout.stripe.com/session123';
      let redirectedUrl = '';

      // Mock window.location.href setter
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          set href(url: string) { redirectedUrl = url; },
          get href() { return redirectedUrl; }
        },
        writable: true,
        configurable: true
      });

      service.redirectToCheckout();

      const req = httpMock.expectOne(`${API_URL}/payments/checkout`);
      req.flush({ url: mockUrl });

      expect(redirectedUrl).toBe(mockUrl);
    });
  });

  describe('redirectToPortal', () => {
    it('should call createPortal and redirect on success', () => {
      const mockUrl = 'https://billing.stripe.com/portal123';
      let redirectedUrl = '';

      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          set href(url: string) { redirectedUrl = url; },
          get href() { return redirectedUrl; }
        },
        writable: true,
        configurable: true
      });

      service.redirectToPortal();

      const req = httpMock.expectOne(`${API_URL}/payments/portal`);
      req.flush({ url: mockUrl });

      expect(redirectedUrl).toBe(mockUrl);
    });
  });
});
