import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnimeDetailPage } from './anime-detail.page';

describe('AnimeDetailPage', () => {
  let component: AnimeDetailPage;
  let fixture: ComponentFixture<AnimeDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AnimeDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
