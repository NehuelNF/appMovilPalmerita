import { Component, OnInit } from '@angular/core';
import { FavoritesService } from '../../../managers/FavoritesService';

@Component({
  selector: 'app-favoritos',
  templateUrl: './favoritos.page.html',
  styleUrls: ['./favoritos.page.scss'],
})
export class FavoritosPage implements OnInit {
  favorites: any[] = [];

  constructor(private favoritesService: FavoritesService) {}

  ngOnInit() {
    this.favoritesService.getFavorites().subscribe(favs => {
      this.favorites = favs;
    });
  }

  removeFavorite(event: Event, animeId: number) {
    event.stopPropagation(); // Prevent card navigation
    this.favoritesService.removeFromFavorites(animeId);
  }
}
