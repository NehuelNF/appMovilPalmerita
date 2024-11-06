import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';
import { ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-proximamente',
  templateUrl: './proximamente.page.html',
  styleUrls: ['./proximamente.page.scss'],
})
export class ProximamentePage implements OnInit {
  upcomingAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;
  favorites: Set<number> = new Set();

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    this.loadUpcomingAnimes();
    this.loadFavorites();
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

  loadFavorites() {
    this.favoritesService.getFavorites().subscribe(favorites => {
      this.favorites.clear();
      favorites.forEach(anime => {
        const id = anime.mal_id || anime.id;
        if (id) this.favorites.add(id);
      });
    });
  }

  async toggleFavorite(anime: any) {
    try {
      const result = await this.favoritesService.toggleFavorite(anime).pipe(take(1)).toPromise();
      if (!result) {
        throw new Error('No se pudo procesar la solicitud');
      }

      // Actualizar el conjunto de favoritos
      if (result.action === 'added') {
        this.favorites.add(anime.mal_id);
      } else {
        this.favorites.delete(anime.mal_id);
      }

      await this.toastCtrl.create({
        message: result.action === 'added' ? 'Añadido a favoritos' : 'Eliminado de favoritos',
        duration: 2000,
        color: result.action === 'added' ? 'success' : 'medium'
      }).then(toast => toast.present());

    } catch (error) {
      await this.toastCtrl.create({
        message: 'Por favor, inicia sesión para añadir favoritos',
        duration: 3000,
        color: 'danger'
      }).then(toast => toast.present());
    }
  }

  isFavorite(animeId: number): boolean {
    return this.favorites.has(animeId);
  }
}