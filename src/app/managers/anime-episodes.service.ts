import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface AnimeEpisode {
  number: number;
  title: string;
  url: string;
  slug: string;
}

export interface AnimeInfo {
  slug: string;
  title: string;
  alternativeTitles: string[];
  description: string;
  thumbnail: string;
  status: string;
  type: string;
  genres: string[];
  year: string;
  studio: string;
  episodes: AnimeEpisode[];
  totalEpisodes: number;
  rating: string;
  timestamp: string;
}

export interface EpisodeInfo {
  animeSlug: string;
  episodeNumber: number;
  title: string;
  animeTitle: string;
  description: string;
  thumbnail: string;
  videoSources: Array<{
    type: string;
    url: string;
    quality: string;
  }>;
  downloadLinks: Array<{
    url: string;
    quality: string;
    format: string;
  }>;
  nextEpisode: { episodeNumber: number; url: string } | null;
  previousEpisode: { episodeNumber: number; url: string } | null;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnimeEpisodesService {
  private apiUrl = '/api/anime-episodes';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene información completa del anime incluyendo lista de episodios
   */
  getAnimeInfo(animeSlug: string): Observable<AnimeInfo> {
    const url = `${this.apiUrl}?animeSlug=${encodeURIComponent(animeSlug)}`;
    
    return this.http.get<AnimeInfo>(url).pipe(
      catchError((error) => {
        console.error('Error obteniendo información del anime:', error);
        // Retornar datos de fallback
        return of({
          slug: animeSlug,
          title: 'Anime no encontrado',
          alternativeTitles: [],
          description: 'No se pudo cargar la información del anime',
          thumbnail: '',
          status: 'Desconocido',
          type: 'Desconocido',
          genres: [],
          year: '',
          studio: '',
          episodes: [],
          totalEpisodes: 0,
          rating: '',
          timestamp: new Date().toISOString()
        } as AnimeInfo);
      })
    );
  }

  /**
   * Obtiene información específica de un episodio
   */
  getEpisodeInfo(animeSlug: string, episodeNumber: number): Observable<EpisodeInfo> {
    const url = `${this.apiUrl}?animeSlug=${encodeURIComponent(animeSlug)}&episodeNumber=${episodeNumber}`;
    
    return this.http.get<EpisodeInfo>(url).pipe(
      catchError((error) => {
        console.error('Error obteniendo información del episodio:', error);
        // Retornar datos de fallback
        return of({
          animeSlug,
          episodeNumber,
          title: 'Episodio no encontrado',
          animeTitle: '',
          description: 'No se pudo cargar la información del episodio',
          thumbnail: '',
          videoSources: [],
          downloadLinks: [],
          nextEpisode: null,
          previousEpisode: null,
          timestamp: new Date().toISOString()
        } as EpisodeInfo);
      })
    );
  }

  /**
   * Busca episodios por slug del anime
   */
  searchAnimeEpisodes(animeSlug: string): Observable<AnimeEpisode[]> {
    return this.getAnimeInfo(animeSlug).pipe(
      map(animeInfo => animeInfo.episodes || [])
    );
  }

  /**
   * Verifica si un episodio específico existe
   */
  checkEpisodeExists(animeSlug: string, episodeNumber: number): Observable<boolean> {
    return this.getEpisodeInfo(animeSlug, episodeNumber).pipe(
      map(episodeInfo => episodeInfo.title !== 'Episodio no encontrado'),
      catchError(() => of(false))
    );
  }
}