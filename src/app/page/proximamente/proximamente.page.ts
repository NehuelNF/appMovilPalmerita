import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';

@Component({
  selector: 'app-proximamente',
  templateUrl: './proximamente.page.html',
  styleUrls: ['./proximamente.page.scss'],
})
export class ProximamentePage implements OnInit {
  upcomingAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService
  ) { }

  ngOnInit() {
    this.loadUpcomingAnimes();
  }

  loadUpcomingAnimes() {
    this.isLoading = true;
    this.animeService.getUpcomingAnime().subscribe({
      next: (response: any) => {
        this.upcomingAnimes = response.data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los animes próximos a estrenarse';
        this.isLoading = false;
        console.error('Error:', err);
      }
    });
  }

  toggleFavorite(event: Event, anime: any) {
    event.stopPropagation();
    if (this.favoritesService.isFavorite(anime.mal_id)) {
      this.favoritesService.removeFromFavorites(anime.mal_id);
    } else {
      this.favoritesService.addToFavorites(anime);
    }
  }

  isFavorite(animeId: number): boolean {
    return this.favoritesService.isFavorite(animeId);
  }
}