// src/app/managers/AnimeService.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, timer } from 'rxjs';
import { catchError, retry, delay, shareReplay, tap, map } from 'rxjs/operators';
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
  // Solo searchAnime usará Anilist y solo devolverá los nombres
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
    // Solo obtener nombres desde Anilist
    const query = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME) {
            id
            title { english romaji native }
          }
        }
      }
    `;
    const variables = { search: queryStr, page: 1, perPage: 20 };
    return this.anilistQuery<any>(query, variables).pipe(
      map(resp => {
        const data = resp['data']?.Page?.media || [];
        // Usar siempre el nombre en inglés si existe
        const mapped = data.map((anime: any) => ({
          mal_id: anime.id,
          id: anime.id,
          title: anime.title.english || anime.title.romaji || anime.title.native
        }));
        const response = { data: mapped, pagination: {} };
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
        return response;
      })
    );
  }

  private baseUrl = 'https://api.jikan.moe/v4';
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
    return this.http.post<T>(this.baseUrl, { query, variables }).pipe(
      catchError(this.handleApiError)
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

  // Adaptar getTopAnime a Anilist
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
      retry(2),
      delay(1200),
      map(response => ({
        ...response,
        data: this.processAnimeData(response.data)
      })),
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

  // Adaptar getAnimeById a Anilist
  getAnimeById(id: number): Observable<any> {
    const cacheKey = `anime-${id}`;
    if (this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }
    return this.http.get<{data: any}>(`${this.baseUrl}/anime/${id}/full`).pipe(
      retry(2),
      delay(1400),
      map(response => {
        if (!response || !response.data) {
          throw new Error(`Anime con ID ${id} no encontrado`);
        }
        const processedAnime = this.processAnimeData([response.data])[0];
        this.cache.set(cacheKey, { data: processedAnime, timestamp: Date.now() });
        return processedAnime;
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