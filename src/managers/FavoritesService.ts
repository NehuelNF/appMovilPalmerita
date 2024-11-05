import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private favorites: any[] = [];
  private favoritesSubject = new BehaviorSubject<any[]>([]);

  constructor() {
    // Cargar favoritos del localStorage al iniciar
    const stored = localStorage.getItem('favorites');
    if (stored) {
      this.favorites = JSON.parse(stored);
      this.favoritesSubject.next(this.favorites);
    }
  }

  getFavorites(): Observable<any[]> {
    return this.favoritesSubject.asObservable();
  }

  addToFavorites(anime: any): void {
    if (!this.favorites.find(fav => fav.mal_id === anime.mal_id)) {
      this.favorites.push(anime);
      this.updateStorage();
    }
  }

  removeFromFavorites(animeId: number): void {
    this.favorites = this.favorites.filter(fav => fav.mal_id !== animeId);
    this.updateStorage();
  }

  isFavorite(animeId: number): boolean {
    return this.favorites.some(fav => fav.mal_id === animeId);
  }

  private updateStorage(): void {
    localStorage.setItem('favorites', JSON.stringify(this.favorites));
    this.favoritesSubject.next(this.favorites);
  }
}