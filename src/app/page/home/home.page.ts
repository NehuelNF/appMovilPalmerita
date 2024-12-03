import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';
import { ToastController } from '@ionic/angular';
import { take } from 'rxjs/operators';
import { LocationService, SavedLocation } from '../../../managers/LocationService';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

interface SearchResult {
  display_name: string;
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  topAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;
  favorites: Set<number> = new Set();
  currentLocation: string = '';
  currentCoords: { latitude: number; longitude: number } = { latitude: 0, longitude: 0 };
  mapUrl: string = '';
  searchResults: SearchResult[] = [];
  private searchText$ = new Subject<string>();
  selectedLocation: SearchResult | null = null;
  savedLocations: SavedLocation[] = [];

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService,
    private toastCtrl: ToastController,
    private locationService: LocationService, // Updated service name
    private sanitizer: DomSanitizer
  ) {
    this.setupLocationSearch();
  }

  ngOnInit() {
    this.loadTopAnimes();
    this.loadFavorites();
    this.loadSavedLocations();
  }

  ionViewDidEnter() {
    this.getCurrentLocation();
  }

  getMapUrl() {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.mapUrl);
  }

  async getCurrentLocation() {
    try {
      this.currentLocation = 'Obteniendo ubicación...';
      const position = await this.locationService.getCurrentLocation();
      this.currentCoords = position; // Store coordinates for map
      this.currentLocation = `Lat: ${position.latitude.toFixed(4)}\nLong: ${position.longitude.toFixed(4)}`;
      this.mapUrl = `https://maps.google.com/maps?q=${position.latitude},${position.longitude}&z=15&output=embed`;
    } catch (error: any) {
      console.error('Error:', error);
      this.currentLocation = 'Error al obtener ubicación';
      
      const toast = await this.toastCtrl.create({
        message: error.message || 'No se pudo obtener la ubicación',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }

  loadTopAnimes() {
    this.isLoading = true;
    this.animeService.getTopAnime().subscribe({
      next: (response: any) => {
        this.topAnimes = response.data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los animes top';
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

  async toggleFavorite(anime: any, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      const result = await this.favoritesService.toggleFavorite(anime).pipe(take(1)).toPromise();
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

  private setupLocationSearch() {
    this.searchText$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(text => text ? this.locationService.searchLocation(text) : [])
    ).subscribe((results: SearchResult[]) => {
      this.searchResults = results;
    });
  }

  onSearchChange(event: any) {
    const query = event.target.value;
    if (query) {
      this.searchText$.next(query);
    } else {
      this.searchResults = [];
    }
  }

  selectLocation(location: SearchResult) {
    this.selectedLocation = location;
    this.currentCoords = {
      latitude: location.latitude,
      longitude: location.longitude
    };
    this.currentLocation = location.display_name;
    this.mapUrl = `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`;
    this.searchResults = [];
  }

  async saveCurrentLocation() {
    if (!this.selectedLocation) return;

    try {
      await this.locationService.saveLocation({
        name: this.selectedLocation.display_name,
        latitude: this.selectedLocation.latitude,
        longitude: this.selectedLocation.longitude
      }).pipe(take(1)).toPromise();

      const toast = await this.toastCtrl.create({
        message: 'Ubicación guardada exitosamente',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      this.selectedLocation = null;
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'Error al guardar la ubicación',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }

  async deleteLocation(locationId: string) {
    try {
      await this.locationService.deleteLocation(locationId).pipe(take(1)).toPromise();
      const toast = await this.toastCtrl.create({
        message: 'Ubicación eliminada exitosamente',
        duration: 2000,
        color: 'success'
      });
      toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'Error al eliminar la ubicación',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }

  loadSavedLocations() {
    this.locationService.getSavedLocations().subscribe(locations => {
      this.savedLocations = locations;
    });
  }

  async navigateToLocation(destination: SavedLocation) {
    try {
      const currentPosition = await this.locationService.getCurrentLocation();
      const url = `https://www.google.com/maps/dir/?api=1&origin=${currentPosition.latitude},${currentPosition.longitude}&destination=${destination.latitude},${destination.longitude}`;
      window.open(url, '_blank');
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'Error al obtener la ubicación actual',
        duration: 2000,
        color: 'danger'
      });
      toast.present();
    }
  }
}
