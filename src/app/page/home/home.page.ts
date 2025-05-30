import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';
import { take } from 'rxjs/operators';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { Subject, of } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  topAnimes: any[] = [];
  filteredAnimes: any[] = [];
  searchTerm: string = '';
  isLoading = true; // For initial load of top animes
  isSearching = false; // For search operation
  error: string | null = null;
  favorites: Set<number> = new Set();
  private searchSubject = new Subject<string>();

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadTopAnimes();
    this.loadFavorites();
    this.setupSearch();
  }

  async handleRefresh(event: any) {
    try {
      this.loadTopAnimes();
      this.loadFavorites();
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
      tap(term => { // Use tap to set searchTerm and isSearching synchronously
        this.searchTerm = term.trim();
        this.isSearching = !!this.searchTerm; // true if searchTerm is not empty
        if (!this.searchTerm) {
            // If search term is cleared, show top 3. this.topAnimes is already processed top 3.
            this.filteredAnimes = [...this.topAnimes];
        }
        this.error = null; // Clear error on new search term
      }),
      switchMap(term => { // term is already trimmed here
        if (!term) {
          // If term is empty, return an observable with the already set top 3 animes
          return of({ data: this.filteredAnimes, pagination: {} });
        }
        // If term is not empty, perform the search
        return this.animeService.searchAnime(term).pipe(
          catchError(err => {
            console.error('Error during anime search API call:', err);
            this.error = 'Error al buscar animes.';
            // isSearching will be set to false in the subscribe block's error/next handler
            return of({ data: [], pagination: {} }); // Return empty on API error
          })
        );
      })
    ).subscribe({
      next: (response: any) => { // response is AnimeResponse-like
        // If the term was empty, filteredAnimes was already updated in tap.
        // If the term was not empty, update with search results.
        if (this.searchTerm) {
            this.filteredAnimes = response.data || [];
        }
        this.isSearching = false; // Search/update process is complete
      },
      error: (err: any) => {
        this.isSearching = false;
        this.error = 'Ocurrió un error con la funcionalidad de búsqueda.';
        console.error('Error in search observable pipeline:', err);
        // Fallback: if the whole pipeline errors, show top 3
        this.filteredAnimes = [...this.topAnimes]; // Use spread for new array
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
            // Process all animes from response to add 'topRank' as their 1-based index
            const allAnimesProcessed = response.data.map((anime: any, index: number) => ({
              ...anime,
              topRank: index + 1 // Assigns 1, 2, 3,... for display purposes
            }));

            // Store only the top 3 of these processed animes
            this.topAnimes = allAnimesProcessed.slice(0, 3);

            // Update filteredAnimes: if no search term, show top 3, else preserve search results
            this.filteredAnimes = this.searchTerm ? this.filteredAnimes : [...this.topAnimes];
          } else { // API returned an empty list
            this.topAnimes = [];
            this.filteredAnimes = [];
            console.info('Top animes API returned an empty list.');
            // Optionally, set a user-facing message if desired, e.g., this.error = 'No animes to display';
          }
        } else { // Invalid response structure
          this.topAnimes = [];
          this.filteredAnimes = [];
          console.warn('Top animes data is not in the expected format or is missing:', response);
          this.error = 'No se pudieron cargar los animes destacados.';
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        this.isLoading = false;
        this.error = err.message || 'Error al cargar los animes principales';
        console.error('Error loading top animes:', err);
        this.topAnimes = []; // Ensure lists are cleared on error
        this.filteredAnimes = [];
      }
    });
  }

  onSearchInput(event: any) {
    const searchTerm = event.target.value.toLowerCase().trim();
    this.searchTerm = searchTerm;
    this.searchSubject.next(searchTerm);
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
      // Use firstValueFrom instead of deprecated toPromise
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
