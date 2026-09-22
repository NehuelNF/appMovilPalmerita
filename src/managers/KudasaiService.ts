import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, map, shareReplay } from 'rxjs/operators';

export interface Noticia {
  titulo: string;
  descripcion: string;
  imagen: string;
  fecha: string;
  url: string;
  categoria?: string;
  autor?: string;
}

export interface NoticiasResponse {
  status: 'ok' | 'stale' | 'unavailable';
  cached?: boolean;
  lastUpdated: string;
  source?: 'rss' | 'scraping';
  error?: string;
  noticias: Noticia[];
}

@Injectable({
  providedIn: 'root'
})
export class KudasaiService {
  private noticiasSubject = new BehaviorSubject<Noticia[]>([]);
  public noticias$ = this.noticiasSubject.asObservable();

  private lastUpdatedSubject = new BehaviorSubject<string | null>(null);
  public lastUpdated$ = this.lastUpdatedSubject.asObservable();

  private sourceSubject = new BehaviorSubject<string>('Servidor');
  public source$ = this.sourceSubject.asObservable();

  private isSourceDownSubject = new BehaviorSubject<boolean>(false);
  public isSourceDown$ = this.isSourceDownSubject.asObservable();

  constructor(private http: HttpClient) {}

  obtenerNoticias(forceRefresh: boolean = false): Observable<Noticia[]> {
    return this.http.get<NoticiasResponse>('/api/noticias').pipe(
      map(response => {
        if (!response) {
          throw new Error('No se recibió respuesta del servidor de noticias.');
        }

        if (response.status === 'unavailable') {
          this.isSourceDownSubject.next(true);
          this.lastUpdatedSubject.next(response.lastUpdated || null);
          throw new Error(response.error || 'El servicio de noticias de Somos Kudasai está temporalmente caído.');
        }

        this.isSourceDownSubject.next(false);
        this.lastUpdatedSubject.next(response.lastUpdated || new Date().toISOString());
        this.sourceSubject.next(response.source === 'rss' ? 'RSS oficial' : 'Respaldo web');

        const noticias = (response.noticias || []).map(n => ({
          ...n,
          imagen: n.imagen || 'assets/images/palmeritachan.png',
          categoria: n.categoria || 'Anime',
          autor: n.autor || 'Somos Kudasai'
        }));

        this.noticiasSubject.next(noticias);
        return noticias;
      }),
      catchError(error => {
        console.error('Error obteniendo noticias desde /api/noticias:', error);
        this.isSourceDownSubject.next(true);
        return throwError(() => error);
      }),
      shareReplay(1)
    );
  }

  refreshNoticias(): Observable<Noticia[]> {
    return this.obtenerNoticias(true);
  }
}