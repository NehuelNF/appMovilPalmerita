import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

export interface WatchProgress {
  animeId: number;
  animeTitle?: string;
  animeImage?: string;
  totalEpisodes?: number;
  watchedEpisodes: number[];
  lastEpisode: number;
  playbackPositions: { [episodeNumber: string]: number };
  updatedAt: any;
}

@Injectable({
  providedIn: 'root'
})
export class WatchProgressService {
  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth
  ) {}

  /**
   * Obtiene el progreso de un anime para el usuario autenticado.
   */
  getProgress(animeId: number | string): Observable<WatchProgress | null> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) return of(null);
        return this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('watchProgress')
          .doc(String(animeId))
          .valueChanges()
          .pipe(
            map(data => {
              if (!data) return null;
              const doc = data as any;
              return {
                animeId: Number(doc.animeId || animeId),
                animeTitle: doc.animeTitle || '',
                animeImage: doc.animeImage || '',
                totalEpisodes: doc.totalEpisodes || 0,
                watchedEpisodes: Array.isArray(doc.watchedEpisodes) ? doc.watchedEpisodes : [],
                lastEpisode: Number(doc.lastEpisode || 1),
                playbackPositions: doc.playbackPositions || {},
                updatedAt: doc.updatedAt || null
              };
            })
          );
      })
    );
  }

  /**
   * Obtiene todos los animes con progreso de visualización, ordenados por última actualización.
   */
  getAllProgress(): Observable<WatchProgress[]> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('watchProgress', ref => ref.orderBy('updatedAt', 'desc'))
          .valueChanges({ idField: 'docId' })
          .pipe(
            map(docs => {
              return (docs as any[]).map(doc => ({
                animeId: Number(doc.animeId || doc.docId),
                animeTitle: doc.animeTitle || '',
                animeImage: doc.animeImage || '',
                totalEpisodes: doc.totalEpisodes || 0,
                watchedEpisodes: Array.isArray(doc.watchedEpisodes) ? doc.watchedEpisodes : [],
                lastEpisode: Number(doc.lastEpisode || 1),
                playbackPositions: doc.playbackPositions || {},
                updatedAt: doc.updatedAt || null
              }));
            })
          );
      })
    );
  }

  /**
   * Registra el inicio de visualización de un episodio (actualiza lastEpisode, título, imagen).
   */
  async recordEpisodeOpen(anime: any, episodeNumber: number): Promise<void> {
    const user = await this.auth.currentUser;
    if (!user) return;

    const animeId = String(anime.mal_id || anime.id);
    const episodeNum = Number(episodeNumber);
    const ref = this.firestore
      .collection('users')
      .doc(user.uid)
      .collection('watchProgress')
      .doc(animeId);

    const docSnapshot = await ref.get().pipe(take(1)).toPromise();
    const existing = docSnapshot && docSnapshot.exists ? (docSnapshot.data() as any) : null;

    const currentWatched: number[] = existing && Array.isArray(existing.watchedEpisodes)
      ? [...existing.watchedEpisodes]
      : [];

    const playbackPositions = existing && existing.playbackPositions ? { ...existing.playbackPositions } : {};

    const payload: WatchProgress = {
      animeId: Number(animeId),
      animeTitle: anime.title || existing?.animeTitle || '',
      animeImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || existing?.animeImage || '',
      totalEpisodes: anime.episodes || existing?.totalEpisodes || 0,
      watchedEpisodes: currentWatched,
      lastEpisode: episodeNum,
      playbackPositions,
      updatedAt: new Date().toISOString()
    };

    await ref.set(payload, { merge: true });
  }

  /**
   * Marca o desmarca manualmente un episodio como visto.
   * Si markPreviousAsWatched es true (por ejemplo, el usuario va en el cap 11 y desea marcar también los anteriores 1..10),
   * se agregan todos los episodios anteriores a watchedEpisodes.
   */
  async toggleEpisodeWatched(
    anime: any,
    episodeNumber: number,
    forceState?: boolean,
    markPreviousAsWatched: boolean = false
  ): Promise<{ isWatched: boolean; addedPreviousCount: number }> {
    const user = await this.auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión para guardar tu progreso.');

    const animeId = String(anime.mal_id || anime.id);
    const episodeNum = Number(episodeNumber);
    const ref = this.firestore
      .collection('users')
      .doc(user.uid)
      .collection('watchProgress')
      .doc(animeId);

    const docSnapshot = await ref.get().pipe(take(1)).toPromise();
    const existing = docSnapshot && docSnapshot.exists ? (docSnapshot.data() as any) : null;

    let watchedSet = new Set<number>(existing && Array.isArray(existing.watchedEpisodes) ? existing.watchedEpisodes : []);
    
    let isWatchedNow: boolean;
    if (typeof forceState === 'boolean') {
      isWatchedNow = forceState;
      if (forceState) {
        watchedSet.add(episodeNum);
      } else {
        watchedSet.delete(episodeNum);
      }
    } else {
      if (watchedSet.has(episodeNum)) {
        watchedSet.delete(episodeNum);
        isWatchedNow = false;
      } else {
        watchedSet.add(episodeNum);
        isWatchedNow = true;
      }
    }

    let addedPreviousCount = 0;
    if (isWatchedNow && markPreviousAsWatched && episodeNum > 1) {
      for (let i = 1; i < episodeNum; i++) {
        if (!watchedSet.has(i)) {
          watchedSet.add(i);
          addedPreviousCount++;
        }
      }
    }

    const payload: Partial<WatchProgress> = {
      animeId: Number(animeId),
      animeTitle: anime.title || existing?.animeTitle || '',
      animeImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || existing?.animeImage || '',
      totalEpisodes: anime.episodes || existing?.totalEpisodes || 0,
      watchedEpisodes: Array.from(watchedSet).sort((a, b) => a - b),
      lastEpisode: episodeNum,
      updatedAt: new Date().toISOString()
    };

    await ref.set(payload, { merge: true });
    return { isWatched: isWatchedNow, addedPreviousCount };
  }

  /**
   * Guarda la posición de reproducción de un episodio en segundos.
   * Si supera el 85% de la duración total (o evento ended), lo marca automáticamente como visto.
   */
  async savePlaybackPosition(anime: any, episodeNumber: number, positionSeconds: number, durationSeconds?: number): Promise<boolean> {
    const user = await this.auth.currentUser;
    if (!user) return false;

    const animeId = String(anime.mal_id || anime.id);
    const episodeNum = Number(episodeNumber);
    const posSec = Math.floor(positionSeconds);

    const ref = this.firestore
      .collection('users')
      .doc(user.uid)
      .collection('watchProgress')
      .doc(animeId);

    const docSnapshot = await ref.get().pipe(take(1)).toPromise();
    const existing = docSnapshot && docSnapshot.exists ? (docSnapshot.data() as any) : null;

    const watchedSet = new Set<number>(existing && Array.isArray(existing.watchedEpisodes) ? existing.watchedEpisodes : []);
    const playbackPositions = existing && existing.playbackPositions ? { ...existing.playbackPositions } : {};
    playbackPositions[String(episodeNum)] = posSec;

    let newlyCompleted = false;
    if (durationSeconds && durationSeconds > 0) {
      const completionRatio = positionSeconds / durationSeconds;
      if (completionRatio >= 0.85 && !watchedSet.has(episodeNum)) {
        watchedSet.add(episodeNum);
        newlyCompleted = true;
      }
    }

    const payload: Partial<WatchProgress> = {
      animeId: Number(animeId),
      animeTitle: anime.title || existing?.animeTitle || '',
      animeImage: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || existing?.animeImage || '',
      totalEpisodes: anime.episodes || existing?.totalEpisodes || 0,
      watchedEpisodes: Array.from(watchedSet).sort((a, b) => a - b),
      lastEpisode: episodeNum,
      playbackPositions,
      updatedAt: new Date().toISOString()
    };

    await ref.set(payload, { merge: true });
    return newlyCompleted;
  }
}
