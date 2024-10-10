import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeasonPage } from './season.page';

describe('SeasonPage', () => {
  let component: SeasonPage;
  let fixture: ComponentFixture<SeasonPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SeasonPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
