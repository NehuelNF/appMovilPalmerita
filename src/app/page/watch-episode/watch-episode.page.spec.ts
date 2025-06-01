import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WatchEpisodePage } from './watch-episode.page';

describe('WatchEpisodePage', () => {
  let component: WatchEpisodePage;
  let fixture: ComponentFixture<WatchEpisodePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(WatchEpisodePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
