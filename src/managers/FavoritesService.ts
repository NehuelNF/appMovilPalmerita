import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth
  ) {}

  toggleFavorite(anime: any): Observable<{ action: string }> {
    if (!anime || (!anime.mal_id && !anime.id)) {
      throw new Error('Anime ID is required');
    }

    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) throw new Error('Must be logged in');
        
        const animeId = (anime.mal_id || anime.id).toString();
        const favoriteRef = this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('favorites')
          .doc(animeId);

        return favoriteRef.get().pipe(
          switchMap(doc => {
            if (doc.exists) {
              return favoriteRef.delete().then(() => ({ action: 'removed' }));
            } else {
              const animeData = {
                ...anime,
                id: parseInt(animeId),
                mal_id: parseInt(animeId)
              };
              return favoriteRef.set(animeData).then(() => ({ action: 'added' }));
            }
          })
        );
      })
    );
  }

  isFavorite(animeId: number): Observable<boolean> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) return of(false);
        return this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('favorites')
          .doc(animeId.toString())
          .get()
          .pipe(
            map(doc => doc.exists)
          );
      })
    );
  }

  getFavorites(): Observable<any[]> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('favorites')
          .valueChanges();
      })
    );
  }

  // Método simplificado para remover favorito
  removeFavorite(animeId: number | string): Observable<void> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) throw new Error('Must be logged in');
        
        return this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('favorites')
          .doc(animeId.toString())
          .delete();
      })
    );
  }

  updateAnimeProgress(anime: any): Observable<void> {
    if (!anime || (!anime.mal_id && !anime.id)) {
      throw new Error('Anime ID is required');
    }

    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) throw new Error('Must be logged in');
        
        const animeId = (anime.mal_id || anime.id).toString();
        return this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('favorites')
          .doc(animeId)
          .update({
            episodesWatched: anime.episodesWatched
          });
      })
    );
  }
}