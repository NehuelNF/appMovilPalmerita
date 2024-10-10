import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoticiaPage } from './noticia.page';

describe('NoticiaPage', () => {
  let component: NoticiaPage;
  let fixture: ComponentFixture<NoticiaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NoticiaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
