import { TestBed } from '@angular/core/testing';

import { AutnServices } from './autn.services';

describe('AutnServices', () => {
  let service: AutnServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AutnServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
