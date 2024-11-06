import { Component, OnInit } from '@angular/core';
import { FavoritesService } from '../../../managers/FavoritesService';
import { ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';  // Añadir esta importación

@Component({
  selector: 'app-favoritos',
  templateUrl: './favoritos.page.html',
  styleUrls: ['./favoritos.page.scss'],
})
export class FavoritosPage implements OnInit {
  favorites: any[] = [];

  constructor(
    private favoritesService: FavoritesService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadFavorites();
  }

  loadFavorites() {
    this.favoritesService.getFavorites().subscribe(favorites => {
      this.favorites = favorites;
    });
  }

  async removeFavorite(anime: any) {
    try {
      const animeId = anime.mal_id || anime.id;
      if (!animeId) {
        throw new Error('No anime ID found');
      }

      await this.favoritesService.removeFavorite(animeId).toPromise();
      this.loadFavorites();
      
      const toast = await this.toastCtrl.create({
        message: 'Anime removed from favorites',
        duration: 2000
      });
      toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: error instanceof Error ? error.message : 'Error removing favorite',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }

  isFavorite(animeId: number): Observable<boolean> {
    return this.favoritesService.isFavorite(animeId);
  }

  async increaseEpisodesWatched(anime: any) {
    const currentEpisodes = anime.episodesWatched || 0;
    if (!anime.episodes || currentEpisodes < anime.episodes) {
      anime.episodesWatched = currentEpisodes + 1;
      await this.updateAnimeProgress(anime);
    }
  }

  async decreaseEpisodesWatched(anime: any) {
    const currentEpisodes = anime.episodesWatched || 0;
    if (currentEpisodes > 0) {
      anime.episodesWatched = currentEpisodes - 1;
      await this.updateAnimeProgress(anime);
    }
  }

  private async updateAnimeProgress(anime: any) {
    try {
      await this.favoritesService.updateAnimeProgress({
        ...anime,
        id: anime.mal_id,
        episodesWatched: anime.episodesWatched || 0
      }).pipe(take(1)).toPromise();

      const toast = await this.toastCtrl.create({
        message: `Progreso actualizado: ${anime.episodesWatched}/${anime.episodes || 'Desconocido'} episodios`,
        duration: 2000,
        color: 'success'
      });
      toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'Error al actualizar el progreso',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }
}
