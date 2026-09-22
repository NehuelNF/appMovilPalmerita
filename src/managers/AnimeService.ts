// src/app/managers/AnimeService.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, timer, of, forkJoin } from 'rxjs';
import { catchError, retry, delay, shareReplay, tap, map, switchMap } from 'rxjs/operators';
import { TimezoneService } from './TimezoneService';

interface AnimeResponse {
  data: any[];
  pagination: any;
}

interface CachedData {
  data: AnimeResponse;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnimeService {
  // Buscar anime usando Jikan con fallback transparente a AniList
  searchAnime(queryStr: string): Observable<AnimeResponse> {
    if (!queryStr || queryStr.trim().length < 2) {
      return new Observable(subscriber => {
        subscriber.next({ data: [], pagination: {} });
        subscriber.complete();
      });
    }
    
    const cacheKey = `search-${queryStr.toLowerCase()}`;
    if (this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }

    // Intentar primero con Jikan
    return this.http.get<AnimeResponse>(`${this.baseUrl}/anime?q=${encodeURIComponent(queryStr)}&limit=20`).pipe(
      retry(1),
      delay(400),
      map(response => {
        const processedData = this.processAnimeData(response.data || []);
        const finalResponse = {
          ...response,
          data: processedData
        };
        this.cache.set(cacheKey, { data: finalResponse, timestamp: Date.now() });
        return finalResponse;
      }),
      catchError(jikanErr => {
        console.warn(`Jikan search falló para "${queryStr}". Usando fallback a AniList...`, jikanErr);
        return this.searchAnimeFromAnilist(queryStr).pipe(
          tap(anilistResponse => {
            this.cache.set(cacheKey, { data: anilistResponse, timestamp: Date.now() });
          })
        );
      })
    );
  }

  // Fallback de búsqueda directa a AniList
  private searchAnimeFromAnilist(queryStr: string): Observable<AnimeResponse> {
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 20) {
          pageInfo {
            total
            hasNextPage
          }
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            description(asHtml: false)
            episodes
            duration
            status
            format
            bannerImage
            coverImage {
              extraLarge
              large
              medium
            }
            genres
            averageScore
            season
            seasonYear
            startDate {
              year
              month
              day
            }
          }
        }
      }
    `;
    const variables = { search: queryStr };
    return this.http.post<any>(this.anilistUrl, { query, variables }).pipe(
      map(response => {
        const mediaList = response?.data?.Page?.media || [];
        const animes = mediaList.map((media: any) => {
          let airedDateString = null;
          if (media.startDate?.year) {
            const y = media.startDate.year;
            const m = String(media.startDate.month || 1).padStart(2, '0');
            const d = String(media.startDate.day || 1).padStart(2, '0');
            airedDateString = `${y}-${m}-${d}T00:00:00+00:00`;
          }

          return {
            mal_id: media.idMal || media.id,
            id: media.id,
            title: media.title?.english || media.title?.romaji || media.title?.native || 'Sin título',
            title_english: media.title?.english || null,
            title_japanese: media.title?.native || null,
            title_romaji: media.title?.romaji || null,
            synopsis: media.description || 'Sin descripción disponible.',
            images: {
              jpg: {
                image_url: media.coverImage?.large || media.coverImage?.medium || '',
                small_image_url: media.coverImage?.medium || '',
                large_image_url: media.coverImage?.extraLarge || media.coverImage?.large || ''
              }
            },
            episodes: media.episodes || null,
            status: media.status === 'FINISHED' ? 'Finished Airing' :
                    media.status === 'RELEASING' ? 'Currently Airing' :
                    media.status === 'NOT_YET_RELEASED' ? 'Not yet aired' : media.status,
            airing: media.status === 'RELEASING',
            duration: media.duration ? `${media.duration} min` : null,
            score: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
            genres: (media.genres || []).map((g: string) => ({ name: g })),
            aired: {
              from: airedDateString,
              to: null,
              string: airedDateString ? new Date(airedDateString).toLocaleDateString() : 'Desconocido'
            },
            episodesSource: 'anilist'
          };
        });

        const processed = this.processAnimeData(animes);
        return {
          data: processed,
          pagination: {
            has_next_page: response?.data?.Page?.pageInfo?.hasNextPage || false
          }
        };
      }),
      catchError(error => {
        console.error('Error en búsqueda de AniList:', error);
        return of({ data: [], pagination: {} });
      })
    );
  }

  private baseUrl = 'https://api.jikan.moe/v4';
  private anilistUrl = 'https://graphql.anilist.co';
  private cacheTimeout = 30 * 60 * 1000; // 30 minutos
  private cache = new Map<string, CachedData>();
  
  // Subjects para notificar actualizaciones
  private seasonalAnimeSubject = new BehaviorSubject<any[]>([]);
  private upcomingAnimeSubject = new BehaviorSubject<any[]>([]);
  
  public seasonalAnime$ = this.seasonalAnimeSubject.asObservable();
  public upcomingAnime$ = this.upcomingAnimeSubject.asObservable();

  constructor(
    private http: HttpClient,
    private timezoneService: TimezoneService
  ) {
    // Cargar datos iniciales y configurar actualización automática
    this.loadInitialData();
    this.setupAutoRefresh();
  }

  private loadInitialData() {
    this.getSeasonalAnime(true).subscribe();
    this.getTopAnime().subscribe(); // Add top anime to initial loading
  }

  private setupAutoRefresh() {
    // Actualizar cada 2 horas
    timer(0, 2 * 60 * 60 * 1000).subscribe(() => {
      this.refreshAllData();
    });
  }

  private isDataFresh(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.cacheTimeout;
  }

  private handleApiError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    
    if (error.status === 429) {
      // Rate limit exceeded
      return throwError(() => new Error('Demasiadas solicitudes. Intenta de nuevo en unos minutos.'));
    } else if (error.status === 0) {
      // Network error
      return throwError(() => new Error('Error de conexión. Verifica tu internet.'));
    } else {
      return throwError(() => new Error('Error del servidor. Intenta de nuevo más tarde.'));
    }
  }

  /**
   * Procesa la información de broadcast para obtener horarios chilenos
   * Ahora incluye sincronización de fecha de estreno con día de broadcast
   */
  private processBroadcastInfo(broadcast: any, airedDate?: string): any {
    if (!broadcast.day || !broadcast.time) {
      return broadcast;
    }

    const broadcastInfo = {
      day: broadcast.day,
      time: broadcast.time,
      timezone: broadcast.timezone || 'JST'
    };

    // Si tenemos fecha de estreno, sincronizar con el broadcast
    if (airedDate) {
      const synchronized = this.timezoneService.synchronizeAiredDateWithBroadcast(airedDate, broadcastInfo);
      
      return {
        ...broadcast,
        original: {
          day: broadcast.day,
          time: broadcast.time
        },
        chile: {
          day: synchronized.chileDay,
          time: synchronized.chileTime,
          day_changed: synchronized.wasSynchronized
        },
        synchronized_date: {
          original: synchronized.originalDate,
          synchronized: synchronized.synchronizedDate,
          was_adjusted: synchronized.wasSynchronized
        },
        timezone_info: synchronized.explanation
      };
    } else {
      // Fallback al método anterior si no hay fecha de estreno
      const converted = this.timezoneService.convertJapanBroadcastToChile(broadcastInfo, airedDate);
      
      return {
        ...broadcast,
        original: {
          day: broadcast.day,
          time: broadcast.time
        },
        chile: {
          day: converted.chileDay,
          time: converted.chileTime,
          day_changed: converted.dayChanged
        },
        timezone_info: this.timezoneService.getTimezoneInfo(broadcastInfo, airedDate)
      };
    }
  }

  /**
   * Procesa los datos de anime para convertir fechas a zona horaria de Chile
   */
  private processAnimeData(animeList: any[]): any[] {
    // Primero eliminar duplicados basados en mal_id
    const uniqueAnimes = this.removeDuplicates(animeList);
    
    return uniqueAnimes.map(anime => {
      const processedAnime = { ...anime };
      
      // Obtener fecha de estreno para usar como referencia
      const airedDate = anime.aired?.from;
      
      // Procesar información de broadcast si existe, pasando la fecha de estreno
      if (anime.broadcast) {
        processedAnime.broadcast_chile = this.processBroadcastInfo(anime.broadcast, airedDate);
      }
      
      // Procesar fechas de estreno
      if (anime.aired && anime.aired.from) {
        let dateStringToUseForAiredFrom = anime.aired.from; // Fecha original de la API por defecto

        // Si tenemos información de broadcast procesada Y existe una fecha sincronizada,
        // usamos ESA fecha sincronizada como la fecha de estreno definitiva.
        // Esta fecha ya está calculada para ser el día correcto del primer episodio en Chile.
        if (processedAnime.broadcast_chile && 
            processedAnime.broadcast_chile.synchronized_date &&
            processedAnime.broadcast_chile.synchronized_date.synchronized) {
          dateStringToUseForAiredFrom = processedAnime.broadcast_chile.synchronized_date.synchronized;
        }
        
        // Convertir la string de fecha (original o la sincronizada del broadcast) a un objeto Date.
        // La función convertAiredDateToChile maneja strings ISO o fechas que podrían ser JST.
        const finalAiredDateObject = this.timezoneService.convertAiredDateToChile(dateStringToUseForAiredFrom);

        processedAnime.aired_chile = {
          ...anime.aired, // Mantenemos otros campos de 'aired' como 'to', 'prop', 'string'
          from_chile: finalAiredDateObject, // El objeto Date para usar en la lógica interna
          formatted_chile: this.timezoneService.formatDateForChile(finalAiredDateObject) // El string formateado para mostrar al usuario
        };
      }
      
      return processedAnime;
    });
  }

  /**
   * NUEVO: Función centralizada para eliminar duplicados basados en mal_id
   */
  private removeDuplicates(animeList: any[]): any[] {
    // Validación para prevenir errores
    if (!animeList || !Array.isArray(animeList)) {
      console.warn('🔧 AnimeService: animeList es undefined, null o no es un array:', animeList);
      return [];
    }

    console.log('🔍 removeDuplicates: Procesando', animeList.length, 'animes');
    console.log('🔍 Primeros 3 animes antes de filtrar:', animeList.slice(0, 3).map(anime => ({
      mal_id: anime?.mal_id,
      id: anime?.id,
      title: anime?.title,
      hasValidId: !!(anime?.mal_id || anime?.id)
    })));

    const seen = new Set<number>();
    const uniqueAnimes: any[] = [];
    let duplicatesCount = 0;
    let invalidIdCount = 0;
    
    animeList.forEach((anime, index) => {
      if (!anime) {
        console.warn(`🔍 Anime ${index} es null/undefined`);
        return;
      }

      // Ser más flexible con el ID - aceptar mal_id o id
      const animeId = anime.mal_id || anime.id;
      
      if (!animeId || isNaN(animeId)) {
        invalidIdCount++;
        console.warn(`🔍 Anime sin ID válido (índice ${index}):`, {
          title: anime.title,
          mal_id: anime.mal_id,
          id: anime.id,
          allKeys: Object.keys(anime).slice(0, 10) // Solo primeros 10 keys para no saturar logs
        });
        // Para el top anime, ser más permisivo - incluir incluso sin ID válido si tiene título
        if (anime.title) {
          console.log(`🔧 Incluyendo anime sin ID válido porque tiene título: ${anime.title}`);
          uniqueAnimes.push(anime);
        }
        return;
      }

      if (!seen.has(animeId)) {
        seen.add(animeId);
        uniqueAnimes.push(anime);
      } else {
        duplicatesCount++;
        console.log(`🔍 Duplicado encontrado ID ${animeId}:`, anime.title);
      }
    });
    
    console.log(`🔧 removeDuplicates resultado:`, {
      original: animeList.length,
      duplicados: duplicatesCount,
      sinId: invalidIdCount,
      final: uniqueAnimes.length
    });
    
    if (duplicatesCount > 0) {
      console.log(`🔧 AnimeService: Eliminados ${duplicatesCount} animes duplicados de ${animeList.length} originales`);
    }
    
    if (invalidIdCount > 0) {
      console.log(`⚠️ AnimeService: ${invalidIdCount} animes sin ID válido (algunos incluidos por tener título)`);
    }
    
    return uniqueAnimes;
  }

  /**
   * NUEVO: Método para eliminar animes duplicados basándose en mal_id
   * Prioriza el anime con más información (más campos no nulos)
   */
  private removeDuplicateAnimes(animes: any[]): any[] {
    const uniqueAnimes = new Map<number, any>();
    
    animes.forEach(anime => {
      const id = anime.mal_id;
      if (!id) return; // Ignorar animes sin ID válido
      
      const existing = uniqueAnimes.get(id);
      
      if (!existing) {
        // Primer anime con este ID
        uniqueAnimes.set(id, anime);
      } else {
        // Ya existe un anime con este ID, comparar cuál es mejor
        const betterAnime = this.selectBetterAnime(existing, anime);
        uniqueAnimes.set(id, betterAnime);
      }
    });
    
    // Convertir Map de vuelta a array y ordenar por ID para consistencia
    const result = Array.from(uniqueAnimes.values());
    console.log(`🔄 Eliminados ${animes.length - result.length} duplicados. Total final: ${result.length} animes únicos`);
    
    return result.sort((a, b) => a.mal_id - b.mal_id);
  }

  /**
   * NUEVO: Selecciona el mejor anime entre dos duplicados
   * Prioriza el que tiene más información completa
   */
  private selectBetterAnime(anime1: any, anime2: any): any {
    // Calcular score de completitud para cada anime
    const score1 = this.calculateCompletenessScore(anime1);
    const score2 = this.calculateCompletenessScore(anime2);
    
    console.log(`📊 Comparando duplicados ID ${anime1.mal_id}: Score1=${score1}, Score2=${score2}`);
    
    // Retornar el anime con mayor score de completitud
    return score2 > score1 ? anime2 : anime1;
  }

  /**
   * NUEVO: Calcula un score de completitud basado en qué campos están presentes
   */
  private calculateCompletenessScore(anime: any): number {
    let score = 0;
    
    // Campos importantes que suman puntos
    const importantFields = [
      'title', 'synopsis', 'images', 'genres', 'studios', 'score',
      'episodes', 'status', 'aired', 'broadcast', 'source', 'duration',
      'rating', 'popularity', 'members', 'favorites'
    ];
    
    importantFields.forEach(field => {
      if (anime[field] !== null && anime[field] !== undefined) {
        if (Array.isArray(anime[field])) {
          // Para arrays, sumar puntos por la cantidad de elementos
          score += anime[field].length > 0 ? 2 : 0;
        } else if (typeof anime[field] === 'object') {
          // Para objetos, verificar si no está vacío
          score += Object.keys(anime[field]).length > 0 ? 2 : 0;
        } else if (typeof anime[field] === 'string') {
          // Para strings, verificar que no esté vacío
          score += anime[field].trim().length > 0 ? 1 : 0;
        } else {
          // Para otros tipos (números, booleanos)
          score += 1;
        }
      }
    });
    
    // Bonus por tener datos procesados de Chile
    if (anime.broadcast_chile) score += 3;
    if (anime.aired_chile) score += 2;
    
    return score;
  }

  // Utilidad para hacer peticiones GraphQL a Anilist
  private anilistQuery<T>(query: string, variables: any = {}): Observable<T> {
    return this.http.post<T>(this.anilistUrl, { query, variables }).pipe(
      catchError(this.handleApiError)
    );
  }

  // NUEVO: Obtener información específica de episodios y emisión desde Anilist
  private getAnimeEpisodesFromAnilist(malId: number): Observable<{
    episodes: number | null;
    status: string | null;
    format: string | null;
    nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
  }> {
    const query = `
      query ($id: Int) {
        Media(idMal: $id, type: ANIME) {
          episodes
          status
          format
          nextAiringEpisode {
            episode
            airingAt
            timeUntilAiring
          }
        }
      }
    `;
    const variables = { id: malId };
    return this.http.post<{ data: { Media: any } }>(this.anilistUrl, { query, variables })
      .pipe(
        map((response) => {
          const media = response?.data?.Media;
          return {
            episodes: media?.episodes ?? null,
            status: media?.status ?? null,
            format: media?.format ?? null,
            nextAiringEpisode: media?.nextAiringEpisode ?? null
          };
        }),
        catchError(error => {
          console.warn(`No se pudo obtener información de episodios desde Anilist para MAL ID ${malId}:`, error);
          return of({ episodes: null, status: null, format: null, nextAiringEpisode: null });
        })
      );
  }

  /**
   * Genera el slug estandarizado a partir del título para el proveedor de streaming
   */
  getSlug(title: string): string {
    return (title || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-');
  }

  getStreamingSlugs(title: string): string[] {
    const slug = this.getSlug(title);
    if (!slug) return [];
    // AniList separa los "Dai"; los proveedores los unen en sus URLs.
    const joinedDai = slug.replace(/(?:dai-){2,}daisuki/g, match => match.replace(/-/g, ''));
    return joinedDai === slug ? [slug] : [slug, joinedDai];
  }

  /**
   * Obtiene la lista de capítulos disponibles para reproducción en el servidor
   */
  getAvailableEpisodes(slug: string): Observable<{ availableEpisodes: number[]; count: number; exists: boolean; provider?: string; providers?: string[] }> {
    if (!slug) return of({ availableEpisodes: [], count: 0, exists: false });
    return this.http.get<{ slug?: string; availableEpisodes: number[]; count: number; exists: boolean; provider?: string; providers?: string[] }>('/api/media', {
      params: { slug }
    }).pipe(
      map(res => ({
        availableEpisodes: res.availableEpisodes || [],
        count: res.count || 0,
        exists: !!res.exists,
        provider: res.provider,
        providers: res.providers || (res.provider ? [res.provider] : [])
      })),
      catchError(err => {
        console.warn(`No se pudo obtener disponibilidad de episodios para ${slug}:`, err);
        return of({ availableEpisodes: [], count: 0, exists: false });
      })
    );
  }

  // Adaptar getSeasonalAnime a Anilist
  getSeasonalAnime(forceRefresh: boolean = false): Observable<AnimeResponse> {
    const cacheKey = 'seasonal';
    if (!forceRefresh && this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }
    return this.http.get<AnimeResponse>(`${this.baseUrl}/seasons/now`).pipe(
      retry(2),
      delay(1000),
      map(response => ({
        ...response,
        data: this.processAnimeData(response.data)
      })),
      tap(response => {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
        this.seasonalAnimeSubject.next(response.data);
      }),
      catchError(this.handleApiError),
      shareReplay(1)
    );
  }

  // El top es siempre el ranking de MyAnimeList, nunca el de puntuación de AniList.
  getTopAnime(): Observable<AnimeResponse> {
    const cacheKey = 'top';
    if (this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }
    return this.http.get<AnimeResponse>(`${this.baseUrl}/top/anime`).pipe(
      retry(1),
      delay(600),
      map(response => ({
        ...response,
        data: this.processAnimeData(response.data)
      })),
      catchError(jikanErr => {
        console.warn('Jikan getTopAnime falló. Consultando el ranking de MyAnimeList...', jikanErr);
        return this.http.get<AnimeResponse>('/api/mal-top');
      }),
      tap(response => {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
      }),
      catchError(this.handleApiError),
      shareReplay(1)
    );
  }

  getEpisodeTotalsFromAnilist(ids: number[]): Observable<Record<number, number>> {
    const uniqueIds = [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))];
    if (!uniqueIds.length) return of({});
    const query = `query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(idMal_in: $ids, type: ANIME) { idMal episodes }
      }
    }`;
    const requests = [];
    for (let i = 0; i < uniqueIds.length; i += 50) {
      requests.push(this.http.post<any>(this.anilistUrl, { query, variables: { ids: uniqueIds.slice(i, i + 50) } }).pipe(
        map(response => response?.data?.Page?.media || []),
        catchError(() => of([]))
      ));
    }
    return forkJoin(requests).pipe(map(groups => {
      const totals: Record<number, number> = {};
      for (const group of groups) {
        for (const media of group) {
          if (Number.isSafeInteger(media.idMal) && Number.isSafeInteger(media.episodes) && media.episodes > 0) {
            totals[media.idMal] = media.episodes;
          }
        }
      }
      return totals;
    }));
  }

  // Fallback de top animes desde AniList
  private getTopAnimeFromAnilist(): Observable<AnimeResponse> {
    const query = `
      query {
        Page(page: 1, perPage: 25) {
          media(type: ANIME, sort: SCORE_DESC) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            description(asHtml: false)
            episodes
            duration
            status
            format
            bannerImage
            coverImage {
              extraLarge
              large
              medium
            }
            genres
            averageScore
            season
            seasonYear
            startDate {
              year
              month
              day
            }
          }
        }
      }
    `;
    return this.http.post<any>(this.anilistUrl, { query }).pipe(
      map(response => {
        const mediaList = response?.data?.Page?.media || [];
        const animes = mediaList.map((media: any) => {
          let airedDateString = null;
          if (media.startDate?.year) {
            const y = media.startDate.year;
            const m = String(media.startDate.month || 1).padStart(2, '0');
            const d = String(media.startDate.day || 1).padStart(2, '0');
            airedDateString = `${y}-${m}-${d}T00:00:00+00:00`;
          }

          return {
            mal_id: media.idMal || media.id,
            id: media.id,
            title: media.title?.english || media.title?.romaji || media.title?.native || 'Sin título',
            title_english: media.title?.english || null,
            title_japanese: media.title?.native || null,
            title_romaji: media.title?.romaji || null,
            synopsis: media.description || 'Sin descripción disponible.',
            images: {
              jpg: {
                image_url: media.coverImage?.large || media.coverImage?.medium || '',
                small_image_url: media.coverImage?.medium || '',
                large_image_url: media.coverImage?.extraLarge || media.coverImage?.large || ''
              }
            },
            episodes: media.episodes || null,
            status: media.status === 'FINISHED' ? 'Finished Airing' :
                    media.status === 'RELEASING' ? 'Currently Airing' :
                    media.status === 'NOT_YET_RELEASED' ? 'Not yet aired' : media.status,
            airing: media.status === 'RELEASING',
            duration: media.duration ? `${media.duration} min` : null,
            score: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
            genres: (media.genres || []).map((g: string) => ({ name: g })),
            aired: {
              from: airedDateString,
              to: null,
              string: airedDateString ? new Date(airedDateString).toLocaleDateString() : 'Desconocido'
            },
            episodesSource: 'anilist'
          };
        });

        const processed = this.processAnimeData(animes);
        return {
          data: processed,
          pagination: {}
        };
      })
    );
  }

  // Fallback completo a AniList cuando Jikan devuelve error o timeout
  private getAnimeFromAnilist(malId: number): Observable<any> {
    const query = `
      query ($id: Int) {
        Media(idMal: $id, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          description(asHtml: false)
          episodes
          duration
          status
          format
          nextAiringEpisode {
            episode
            airingAt
          }
          bannerImage
          coverImage {
            extraLarge
            large
            medium
          }
          genres
          averageScore
          season
          seasonYear
          startDate {
            year
            month
            day
          }
          studios {
            nodes {
              name
            }
          }
          trailer {
            id
            site
          }
        }
      }
    `;
    const variables = { id: malId };
    return this.http.post<any>(this.anilistUrl, { query, variables }).pipe(
      map(response => {
        const media = response?.data?.Media;
        if (!media) throw new Error(`Anime con ID ${malId} no encontrado en AniList.`);

        let airedDateString = null;
        if (media.startDate?.year) {
          const y = media.startDate.year;
          const m = String(media.startDate.month || 1).padStart(2, '0');
          const d = String(media.startDate.day || 1).padStart(2, '0');
          airedDateString = `${y}-${m}-${d}T00:00:00+00:00`;
        }

        const standardAnime = {
          mal_id: media.idMal || malId,
          id: media.id,
          title: media.title?.english || media.title?.romaji || media.title?.native || 'Sin título',
          title_english: media.title?.english || null,
          title_japanese: media.title?.native || null,
          title_romaji: media.title?.romaji || null,
          synopsis: media.description || 'Sin descripción disponible.',
          images: {
            jpg: {
              image_url: media.coverImage?.large || media.coverImage?.medium || '',
              small_image_url: media.coverImage?.medium || '',
              large_image_url: media.coverImage?.extraLarge || media.coverImage?.large || ''
            }
          },
          trailer: media.trailer?.id && media.trailer?.site === 'youtube'
            ? { url: `https://www.youtube.com/watch?v=${media.trailer.id}`, youtube_id: media.trailer.id }
            : null,
          episodes: media.episodes || null,
          totalEpisodes: media.episodes || null,
          airedEpisodes: media.status === 'NOT_YET_RELEASED' ? 0 :
            media.status === 'FINISHED' ? (media.episodes || null) :
            media.nextAiringEpisode?.episode ? Math.max(0, media.nextAiringEpisode.episode - 1) : null,
          nextAiringEpisode: media.nextAiringEpisode || null,
          status: media.status === 'FINISHED' ? 'Finished Airing' :
                  media.status === 'RELEASING' ? 'Currently Airing' :
                  media.status === 'NOT_YET_RELEASED' ? 'Not yet aired' : media.status,
          airing: media.status === 'RELEASING',
          duration: media.duration ? `${media.duration} min` : null,
          score: media.averageScore ? (media.averageScore / 10).toFixed(1) : null,
          genres: (media.genres || []).map((g: string) => ({ name: g })),
          studios: (media.studios?.nodes || []).map((s: any) => ({ name: s.name })),
          aired: {
            from: airedDateString,
            to: null,
            string: airedDateString ? new Date(airedDateString).toLocaleDateString() : 'Desconocido'
          },
          episodesSource: 'anilist'
        };

        return this.processAnimeData([standardAnime])[0];
      })
    );
  }

  // Adaptar getAnimeById a Anilist para obtener episodios, manteniendo Jikan para el resto con fallback robusto
  getAnimeById(id: number): Observable<any> {
    const cacheKey = `anime-${id}`;
    if (this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }
    
    // Primero intentar obtener datos desde Jikan
    return this.http.get<{data: any}>(`${this.baseUrl}/anime/${id}/full`).pipe(
      retry(1),
      delay(1200),
      map(response => {
        if (!response || !response.data) {
          throw new Error(`Anime con ID ${id} no encontrado`);
        }
        return this.processAnimeData([response.data])[0];
      }),
      // Luego enriquecer con número de episodios desde Anilist
      switchMap(jikanAnime => {
        return this.getAnimeEpisodesFromAnilist(id).pipe(
          map(anilistData => {
            const finalAnime = { ...jikanAnime };
            const totalPlanned = anilistData.episodes !== null ? anilistData.episodes : (jikanAnime.episodes || null);
            finalAnime.totalEpisodes = totalPlanned;
            finalAnime.episodes = totalPlanned; // Mantener retrocompatibilidad
            finalAnime.anilistStatus = anilistData.status;
            finalAnime.nextAiringEpisode = anilistData.nextAiringEpisode;

            // AniList puede actualizar el estado antes que Jikan. Si ambos
            // discrepan, usar el estado que también proporciona el próximo
            // episodio para no bloquear capítulos ya emitidos.
            if (anilistData.status === 'RELEASING') {
              finalAnime.status = 'Currently Airing';
              finalAnime.airing = true;
            } else if (anilistData.status === 'FINISHED') {
              finalAnime.status = 'Finished Airing';
              finalAnime.airing = false;
            } else if (anilistData.status === 'NOT_YET_RELEASED') {
              finalAnime.status = 'Not yet aired';
              finalAnime.airing = false;
            }

            const isFinished = anilistData.status
              ? anilistData.status === 'FINISHED'
              : !!jikanAnime.status?.toLowerCase().includes('finished');
            const isNotYetAired = anilistData.status
              ? anilistData.status === 'NOT_YET_RELEASED'
              : !!jikanAnime.status?.toLowerCase().includes('not yet');

            if (isFinished) {
              finalAnime.airedEpisodes = totalPlanned;
            } else if (isNotYetAired) {
              finalAnime.airedEpisodes = 0;
            } else if (anilistData.nextAiringEpisode && typeof anilistData.nextAiringEpisode.episode === 'number') {
              finalAnime.airedEpisodes = Math.max(0, anilistData.nextAiringEpisode.episode - 1);
            } else if (totalPlanned !== null && !finalAnime.airing) {
              finalAnime.airedEpisodes = totalPlanned;
            } else {
              finalAnime.airedEpisodes = jikanAnime.episodes || null;
            }

            finalAnime.episodesSource = anilistData.episodes !== null ? 'anilist' : 'jikan';
            console.log(`📺 Anime ${finalAnime.title}: total=${finalAnime.totalEpisodes}, emitidos=${finalAnime.airedEpisodes}, status=${finalAnime.anilistStatus}`);
            
            return finalAnime;
          }),
          catchError(error => {
            console.warn('Error al obtener episodios de Anilist, usando datos de Jikan:', error);
            jikanAnime.episodesSource = 'jikan';
            jikanAnime.totalEpisodes = jikanAnime.episodes || null;
            jikanAnime.airedEpisodes = jikanAnime.episodes || null;
            return of(jikanAnime);
          })
        );
      }),
      // Fallback a AniList completo si Jikan falla (504 gateway timeout, 404 o rate limit)
      catchError(jikanError => {
        console.warn(`Jikan falló para anime ID ${id}. Intentando fallback a AniList...`, jikanError);
        return this.getAnimeFromAnilist(id);
      }),
      tap(finalAnime => {
        this.cache.set(cacheKey, { data: finalAnime, timestamp: Date.now() });
      }),
      catchError(error => this.handleApiError(error)),
      shareReplay(1)
    );
  }

  // NUEVO: Método para limpiar caché
  clearCache() {
    console.log('🧹 Limpiando caché completo...');
    this.cache.clear();
    console.log('✅ Caché limpiado');
  }

  // NUEVO: Método para obtener información del caché
  getCacheInfo() {
    const cacheEntries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp,
      dataSize: Array.isArray(value.data.data) ? value.data.data.length : 1
    }));
    
    return {
      totalEntries: this.cache.size,
      entries: cacheEntries,
      timeout: this.cacheTimeout
    };
  }

  // NUEVO: Método para refrescar todos los datos manualmente
  refreshAllData() {
    console.log('🔄 Refrescando todos los datos manualmente...');
    this.getSeasonalAnime(true).subscribe();
    this.getTopAnime().subscribe();
  }

  // Adaptar getUpcomingAnime a Anilist (animes próximos a estrenarse)
  getUpcomingAnime(forceRefresh: boolean = false): Observable<AnimeResponse> {
    const cacheKey = 'upcoming';
    if (!forceRefresh && this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }
    return this.http.get<AnimeResponse>(`${this.baseUrl}/seasons/upcoming`).pipe(
      retry(2),
      delay(1100),
      map(response => ({
        ...response,
        data: this.processAnimeData(response.data)
      })),
      tap(response => {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });
        this.upcomingAnimeSubject.next(response.data);
      }),
      catchError(this.handleApiError),
      shareReplay(1)
    );
  }
}
