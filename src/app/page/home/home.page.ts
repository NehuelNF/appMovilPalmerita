import { Component, OnInit, OnDestroy } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';
import { WatchProgressService, WatchProgress } from '../../../managers/WatchProgressService';
import { take, debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { Subject, of, Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  topAnimes: any[] = [];
  filteredAnimes: any[] = [];
  searchTerm: string = '';
  searchFocused = false;
  isLoading = true; // For initial load of top animes
  isSearching = false; // For search operation
  error: string | null = null;
  favorites: Set<number> = new Set();
  recentProgress: WatchProgress[] = [];
  private searchSubject = new Subject<string>();
  private progressSub?: Subscription;

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService,
    private watchProgressService: WatchProgressService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.loadTopAnimes();
    this.loadFavorites();
    this.loadWatchProgress();
    this.setupSearch();
  }

  ngOnDestroy() {
    if (this.progressSub) {
      this.progressSub.unsubscribe();
    }
  }

  loadWatchProgress() {
    if (this.progressSub) this.progressSub.unsubscribe();
    this.progressSub = this.watchProgressService.getAllProgress().subscribe({
      next: (list) => {
        // Filtrar y tomar hasta 6 animes recientes
        this.recentProgress = (list || [])
          .filter(item => !item.hiddenFromContinueWatching)
          .slice(0, 6);
      },
      error: (err) => {
        console.error('Error loading watch progress in home:', err);
      }
    });
  }

  getProgressPercentage(item: WatchProgress): number {
    if (!item.totalEpisodes || !item.watchedEpisodes) return 0;
    return Math.min(Math.round((item.watchedEpisodes.length / item.totalEpisodes) * 100), 100);
  }

  async removeContinueWatching(item: WatchProgress, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    const alert = await this.alertCtrl.create({
      header: 'Quitar de continuar viendo',
      message: `¿Deseas quitar "${item.animeTitle || 'este anime'}" de tu lista de continuar viendo?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            this.recentProgress = this.recentProgress.filter(p => p.animeId !== item.animeId);
            try {
              await this.watchProgressService.hideFromContinueWatching(item.animeId);
              const toast = await this.toastCtrl.create({
                message: 'Anime quitado de continuar viendo',
                duration: 2000,
                color: 'medium'
              });
              await toast.present();
            } catch (err) {
              console.error('Error removing watch progress:', err);
              this.loadWatchProgress();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async handleRefresh(event: any) {
    try {
      this.loadTopAnimes();
      this.loadFavorites();
      this.loadWatchProgress();
      if (event && event.target) {
        event.target.complete();
      }
    } catch (error) {
      console.error('Error during refresh:', error);
      if (event && event.target) {
        event.target.complete();
      }
      const toast = await this.toastCtrl.create({
        message: 'Error al recargar los datos.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  setupSearch() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      tap(term => {
        this.searchTerm = term.trim();
        this.isSearching = !!this.searchTerm;
        if (!this.searchTerm) {
          this.filteredAnimes = [...this.topAnimes];
        }
        this.error = null;
      }),
      switchMap(term => {
        if (!term) {
          return of({ data: this.filteredAnimes, pagination: {} });
        }
        return this.animeService.searchAnime(term).pipe(
          catchError(err => {
            console.error('Error during anime search API call:', err);
            this.error = 'Error al buscar animes.';
            return of({ data: [], pagination: {} });
          })
        );
      })
    ).subscribe({
      next: (response: any) => {
        if (this.searchTerm) {
          this.filteredAnimes = response.data || [];
        }
        this.isSearching = false;
      },
      error: (err: any) => {
        this.isSearching = false;
        this.error = 'Ocurrió un error con la funcionalidad de búsqueda.';
        console.error('Error in search observable pipeline:', err);
        this.filteredAnimes = [...this.topAnimes];
      }
    });
  }

  loadTopAnimes() {
    this.isLoading = true;
    this.error = null;
    this.animeService.getTopAnime().subscribe({
      next: (response: any) => {
        if (response && Array.isArray(response.data)) {
          if (response.data.length > 0) {
            const allAnimesProcessed = response.data.map((anime: any, index: number) => ({
              ...anime,
              topRank: index + 1
            }));
            this.topAnimes = allAnimesProcessed.slice(0, 3);
            this.filteredAnimes = this.searchTerm ? this.filteredAnimes : [...this.topAnimes];
          } else {
            this.topAnimes = [];
            this.filteredAnimes = [];
          }
        } else {
          this.topAnimes = [];
          this.filteredAnimes = [];
          this.error = 'No se pudieron cargar los animes destacados.';
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        this.isLoading = false;
        this.error = err.message || 'Error al cargar los animes principales';
        console.error('Error loading top animes:', err);
        this.topAnimes = [];
        this.filteredAnimes = [];
      }
    });
  }

  onSearchInput(event: any) {
    const searchTerm = event.target.value.toLowerCase().trim();
    this.searchTerm = searchTerm;
    this.searchSubject.next(searchTerm);
  }

  getRecentSearchMatches(): WatchProgress[] {
    const term = this.searchTerm.toLocaleLowerCase().trim();
    return this.recentProgress
      .filter(item => !term || (item.animeTitle || '').toLocaleLowerCase().includes(term))
      .slice(0, 4);
  }

  getMatchedAlternativeTitle(anime: any): string {
    if (!this.searchTerm) return '';
    const term = this.searchTerm.toLocaleLowerCase();
    const primary = String(anime.title || '').toLocaleLowerCase();
    if (primary.includes(term)) return '';
    const alternatives = [anime.title_english, anime.title_japanese, anime.title_romaji,
      ...(anime.title_synonyms || []), ...(anime.titles || []).map((item: any) => item?.title)];
    return alternatives.find((title: string) => title && title.toLocaleLowerCase().includes(term)) || '';
  }

  loadFavorites() {
    this.favoritesService.getFavorites().subscribe((favorites: any[]) => {
      this.favorites.clear();
      favorites.forEach((anime: any) => {
        const id = anime.mal_id || anime.id;
        if (id) this.favorites.add(id);
      });
    });
  }

  async toggleFavorite(anime: any, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      const { firstValueFrom } = await import('rxjs');
      const result = await firstValueFrom(this.favoritesService.toggleFavorite(anime).pipe(take(1)));
      if (!result) {
        throw new Error('No se pudo procesar la solicitud');
      }
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
