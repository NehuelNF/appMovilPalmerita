import { Component, OnInit, OnDestroy } from '@angular/core';
import { FavoritesService } from '../../../managers/FavoritesService';
import { AnimeService } from '../../../managers/AnimeService';
import { WatchProgressService, WatchProgress } from '../../../managers/WatchProgressService';
import { ToastController } from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-favoritos',
  templateUrl: './favoritos.page.html',
  styleUrls: ['./favoritos.page.scss'],
})
export class FavoritosPage implements OnInit, OnDestroy {
  favorites: any[] = [];
  progressMap = new Map<number, WatchProgress>();
  private progressSub?: Subscription;
  private favoritesGeneration = 0;

  constructor(
    private favoritesService: FavoritesService,
    private animeService: AnimeService,
    private watchProgressService: WatchProgressService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadFavorites();
    this.subscribeToWatchProgress();
  }

  ngOnDestroy() {
    if (this.progressSub) {
      this.progressSub.unsubscribe();
    }
  }

  subscribeToWatchProgress() {
    if (this.progressSub) this.progressSub.unsubscribe();
    this.progressSub = this.watchProgressService.getAllProgress().subscribe(list => {
      this.progressMap.clear();
      for (const p of list) {
        this.progressMap.set(p.animeId, p);
      }
    });
  }

  loadFavorites() {
    this.favoritesService.getFavorites().subscribe(favorites => {
      const generation = ++this.favoritesGeneration;
      this.favorites = favorites;
      const ids = favorites.map(anime => Number(anime.mal_id || anime.id));
      this.animeService.getEpisodeTotalsFromAnilist(ids).subscribe(totals => {
        if (generation !== this.favoritesGeneration) return;
        this.favorites = favorites.map(anime => {
          const total = totals[Number(anime.mal_id || anime.id)];
          return total ? { ...anime, episodes: total, totalEpisodes: total } : anime;
        });
      });
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
        message: 'Anime eliminado de favoritos',
        duration: 2000
      });
      toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: error instanceof Error ? error.message : 'Error al eliminar favorito',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }

  isFavorite(animeId: number): Observable<boolean> {
    return this.favoritesService.isFavorite(animeId);
  }

  getWatchedCount(anime: any): number {
    const id = Number(anime.mal_id || anime.id);
    const progress = this.progressMap.get(id);
    if (progress && Array.isArray(progress.watchedEpisodes)) {
      return progress.watchedEpisodes.length;
    }
    return anime.episodesWatched || 0;
  }

  // Nuevos métodos para mejorar la UI
  getProgressPercentage(anime: any): number {
    const total = anime.episodes;
    if (!total || total <= 0) return 0;
    const watched = this.getWatchedCount(anime);
    return Math.min(Math.round((watched / total) * 100), 100);
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Currently Airing': 'En emisión',
      'Finished Airing': 'Finalizado',
      'Not yet aired': 'Próximamente',
      'Unknown': 'Desconocido'
    };
    return statusMap[status] || status || 'Desconocido';
  }

  // Método para verificar si el anime está completo
  isCompleted(anime: any): boolean {
    return !!(anime.episodes && this.getWatchedCount(anime) >= anime.episodes);
  }

  // Método para obtener el color de la barra de progreso
  getProgressColor(anime: any): string {
    const percentage = this.getProgressPercentage(anime);
    if (percentage === 100) return 'success';
    if (percentage >= 75) return 'warning';
    if (percentage >= 50) return 'primary';
    return 'medium';
  }
}
