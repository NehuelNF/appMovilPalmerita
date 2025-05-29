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
    this.getUpcomingAnime(true).subscribe();
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
    return animeList.map(anime => {
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
      delay(1000), // Delay para respetar rate limits
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
      delay(1100), // Delay ligeramente diferente para evitar llamadas simultáneas
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

  getTopAnime(): Observable<AnimeResponse> {
    const cacheKey = 'top';
    
    if (this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }

    return this.http.get<AnimeResponse>(`${this.baseUrl}/top/anime?limit=3`).pipe(
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

  getAnimeById(id: number): Observable<any> {
    const cacheKey = `anime-${id}`;
    
    if (this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }

    return this.http.get<any>(`${this.baseUrl}/anime/${id}`).pipe(
      retry(2),
      delay(800),
      map(response => ({
        ...response,
        data: this.processAnimeData([response.data])[0]
      })),
      tap(response => {
        this.cache.set(cacheKey, {
          data: response as AnimeResponse,
          timestamp: Date.now()
        });
      }),
      catchError(this.handleApiError)
    );
  }

  // Método para refrescar todos los datos
  refreshAllData(): void {
    this.getSeasonalAnime(true).subscribe({
      error: (error) => console.error('Error refreshing seasonal anime:', error)
    });
    
    setTimeout(() => {
      this.getUpcomingAnime(true).subscribe({
        error: (error) => console.error('Error refreshing upcoming anime:', error)
      });
    }, 1500); // Espaciar las llamadas
  }

  // Método para limpiar la caché
  clearCache(): void {
    this.cache.clear();
  }

  // Método para obtener el estado de la caché
  getCacheInfo(): { [key: string]: { age: number; size: number } } {
    const info: { [key: string]: { age: number; size: number } } = {};
    const now = Date.now();
    
    this.cache.forEach((value, key) => {
      info[key] = {
        age: now - value.timestamp,
        size: JSON.stringify(value.data).length
      };
    });
    
    return info;
  }
}