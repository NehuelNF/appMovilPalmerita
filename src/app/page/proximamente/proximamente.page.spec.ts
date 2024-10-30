import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProximamentePage } from './proximamente.page';

describe('ProximamentePage', () => {
  let component: ProximamentePage;
  let fixture: ComponentFixture<ProximamentePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProximamentePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
