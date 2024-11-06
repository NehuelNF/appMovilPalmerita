import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-season',
  templateUrl: './season.page.html',
  styleUrls: ['./season.page.scss'],
})
export class SeasonPage implements OnInit {
  animes: any[] = [];
  filteredAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;
  selectedDay: string = 'all';
  favorites: Set<number> = new Set();

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    this.loadAnimes();
    this.loadFavorites();
  }

  daysMap: { [key: string]: string } = {
    monday: 'mondays',
    tuesday: 'tuesdays',
    wednesday: 'wednesdays',
    thursday: 'thursdays',
    friday: 'fridays',
    saturday: 'saturdays',
    sunday: 'sundays'
  };

  loadAnimes() {
    this.isLoading = true;
    this.animeService.getSeasonalAnime().subscribe({
      next: (response: any) => {
        this.animes = response.data;
        this.filteredAnimes = this.animes;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los animes de temporada';
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

  filterAnimesByDay() {
    // console.log('Selected Day:', this.selectedDay);
    if (this.selectedDay === 'all') {
      this.filteredAnimes = this.animes;
    } else {
      const selectedDayPlural = this.daysMap[this.selectedDay.toLowerCase()];
      this.filteredAnimes = this.animes.filter(anime => {
        const broadcastDay = anime.broadcast?.day?.toLowerCase();
        // console.log('Broadcast Day:', broadcastDay);
        return broadcastDay === selectedDayPlural;
      });
    }
  }

  handleRefresh(event: any) {
    this.loadAnimes();
    event.target.complete();
  }

  async toggleFavorite(anime: any) {
    try {
      const result = await this.favoritesService.toggleFavorite(anime).pipe(take(1)).toPromise();
      // Verificar que result no sea undefined
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
