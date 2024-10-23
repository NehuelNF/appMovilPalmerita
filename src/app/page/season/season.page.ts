import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';

@Component({
  selector: 'app-season',
  templateUrl: './season.page.html',
  styleUrls: ['./season.page.scss']
})
export class SeasonPage implements OnInit {
  animes: any[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  constructor(private animeService: AnimeService) {}

  ngOnInit() {
    this.loadAnimes();
  }

  loadAnimes() {
    this.isLoading = true;
    this.error = null;
    
    this.animeService.getSeasonalAnime().subscribe({
      next: (response) => {
        this.animes = response.data;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los animes';
        this.isLoading = false;
        console.error('Error:', err);
      }
    });
  }

  handleRefresh(event: any) {
    this.loadAnimes();
    event.target.complete();
  }
}