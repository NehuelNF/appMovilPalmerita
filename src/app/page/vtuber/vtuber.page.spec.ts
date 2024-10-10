import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VtuberPage } from './vtuber.page';

describe('VtuberPage', () => {
  let component: VtuberPage;
  let fixture: ComponentFixture<VtuberPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VtuberPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
