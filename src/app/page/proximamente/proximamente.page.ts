import { Component, OnInit, OnDestroy } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';
import { ToastController, LoadingController } from '@ionic/angular';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-proximamente',
  templateUrl: './proximamente.page.html',
  styleUrls: ['./proximamente.page.scss'],
})
export class ProximamentePage implements OnInit, OnDestroy {
  upcomingAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;
  favorites: Set<number> = new Set();
  private destroy$ = new Subject<void>();
  lastRefresh: Date | null = null;

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    this.loadUpcomingAnimes();
    this.loadFavorites();
    this.subscribeToAnimeUpdates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToAnimeUpdates() {
    // Suscribirse a actualizaciones automáticas del servicio
    this.animeService.upcomingAnime$
      .pipe(takeUntil(this.destroy$))
      .subscribe(animes => {
        if (animes.length > 0) {
          this.upcomingAnimes = animes;
          this.lastRefresh = new Date();
          console.log('Datos de próximamente actualizados:', this.lastRefresh);
        }
      });
  }

  async loadUpcomingAnimes(showLoading: boolean = true) {
    if (showLoading) {
      this.isLoading = true;
    }
    
    this.error = null;
    
    this.animeService.getUpcomingAnime().subscribe({
      next: (response: any) => {
        this.upcomingAnimes = response.data;
        this.isLoading = false;
        this.lastRefresh = new Date();
      },
      error: (err: any) => {
        this.error = err.message || 'Error al cargar los animes próximos a estrenarse';
        this.isLoading = false;
        console.error('Error:', err);
        if (this.error) {
          this.showErrorToast(this.error);
        }
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

  async handleRefresh(event: any) {
    try {
      await this.forceRefresh();
    } finally {
      event.target.complete();
    }
  }

  async forceRefresh() {
    const loading = await this.loadingCtrl.create({
      message: 'Actualizando datos...',
      duration: 5000
    });
    
    await loading.present();
    
    try {
      await this.animeService.getUpcomingAnime(true).pipe(take(1)).toPromise();
      await this.showSuccessToast('Datos actualizados correctamente');
    } catch (error: any) {
      this.error = error.message || 'Error al actualizar';
      await this.showErrorToast(this.error || 'Error al actualizar');
    } finally {
      await loading.dismiss();
    }
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

  private async showErrorToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }

  private async showSuccessToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
  }

  getLastRefreshText(): string {
    if (!this.lastRefresh) return 'Nunca actualizado';
    
    const now = new Date();
    const diff = now.getTime() - this.lastRefresh.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Actualizado hace menos de 1 minuto';
    if (minutes === 1) return 'Actualizado hace 1 minuto';
    if (minutes < 60) return `Actualizado hace ${minutes} minutos`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Actualizado hace 1 hora';
    return `Actualizado hace ${hours} horas`;
  }
}