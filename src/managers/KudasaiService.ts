import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, retry, delay, shareReplay, tap, map } from 'rxjs/operators';

export interface Noticia {
  titulo: string;
  descripcion: string;
  imagen: string;
  fecha: string;
  url: string;
  categoria?: string;
  autor?: string;
}

interface CachedNoticias {
  data: Noticia[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class KudasaiService {
  private cacheTimeout = 15 * 60 * 1000; // 15 minutos
  private cache = new Map<string, CachedNoticias>();
  
  // URLs para obtener noticias - usando RSS2JSON como proxy gratuito
  private rssProxyUrls = [
    'https://api.rss2json.com/v1/api.json?rss_url=https://somoskudasai.com/feed/',
    'https://api.allorigins.win/get?url=https://somoskudasai.com/feed/'
  ];
  
  // Subject para notificar actualizaciones
  private noticiasSubject = new BehaviorSubject<Noticia[]>([]);
  public noticias$ = this.noticiasSubject.asObservable();

  constructor(private http: HttpClient) {}

  obtenerNoticias(forceRefresh: boolean = false): Observable<Noticia[]> {
    const cacheKey = 'noticias-kudasai';
    
    if (!forceRefresh && this.isDataFresh(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return new Observable(subscriber => {
        subscriber.next(cached.data);
        subscriber.complete();
      });
    }

    return this.tryRSSProxy().pipe(
      retry(1),
      delay(500),
      tap(noticias => {
        this.cache.set(cacheKey, {
          data: noticias,
          timestamp: Date.now()
        });
        this.noticiasSubject.next(noticias);
      }),
      catchError(error => {
        console.error('Error obteniendo noticias:', error);
        return this.obtenerNoticiasSimuladas();
      }),
      shareReplay(1)
    );
  }

  private tryRSSProxy(): Observable<Noticia[]> {
    // Intentar primero con RSS2JSON
    return this.http.get<any>('https://api.rss2json.com/v1/api.json?rss_url=https://somoskudasai.com/feed/').pipe(
      map(response => this.parseRSS2JSON(response)),
      catchError(error => {
        console.warn('RSS2JSON falló, intentando con AllOrigins:', error);
        
        // Fallback a AllOrigins
        return this.http.get<any>('https://api.allorigins.win/get?url=https://somoskudasai.com/feed/').pipe(
          map(response => this.parseAllOrigins(response)),
          catchError(fallbackError => {
            console.warn('AllOrigins también falló:', fallbackError);
            return throwError(() => fallbackError);
          })
        );
      })
    );
  }

  private parseRSS2JSON(response: any): Noticia[] {
    if (!response || !response.items) {
      throw new Error('Formato de respuesta inválido de RSS2JSON');
    }

    return response.items.slice(0, 10).map((item: any) => ({
      titulo: this.cleanText(item.title || 'Sin título'),
      descripcion: this.cleanText(item.description || item.content || 'Sin descripción disponible').slice(0, 200),
      imagen: this.getBestImage(item),
      fecha: item.pubDate || new Date().toISOString(),
      url: item.link || 'https://somoskudasai.com',
      categoria: 'Anime',
      autor: 'Somos Kudasai'
    }));
  }

  private parseAllOrigins(response: any): Noticia[] {
    if (!response || !response.contents) {
      throw new Error('Formato de respuesta inválido de AllOrigins');
    }

    // Parsear XML del RSS
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.contents, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');

    const noticias: Noticia[] = [];
    
    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i];
      const titulo = item.querySelector('title')?.textContent || 'Sin título';
      const descripcion = item.querySelector('description')?.textContent || 'Sin descripción';
      const link = item.querySelector('link')?.textContent || 'https://somoskudasai.com';
      const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();

      noticias.push({
        titulo: this.cleanText(titulo),
        descripcion: this.cleanText(descripcion).slice(0, 200),
        imagen: this.extractImageFromContent(descripcion) || 'assets/images/palmeritachan.png',
        fecha: pubDate,
        url: link,
        categoria: 'Anime',
        autor: 'Somos Kudasai'
      });
    }

    return noticias;
  }

  private extractImageFromContent(content: string): string | null {
    if (!content) return null;
    
    // Lista de patrones para buscar imágenes
    const imagePatterns = [
      // Imagen con src normal
      /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
      // Imagen con data-src (lazy loading)
      /<img[^>]+data-src=["']([^"']+)["'][^>]*>/i,
      // Imagen con data-lazy-src
      /<img[^>]+data-lazy-src=["']([^"']+)["'][^>]*>/i,
      // Imagen en figura
      /<figure[^>]*>.*?<img[^>]+src=["']([^"']+)["'][^>]*>.*?<\/figure>/i,
      // WordPress featured image
      /wp-image-\d+[^>]+src=["']([^"']+)["']/i,
      // URL de imagen directa en el texto
      /https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)/i
    ];

    for (const pattern of imagePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        let imgUrl = match[1];
        
        // Filtrar imágenes no deseadas
        if (this.isValidImageUrl(imgUrl)) {
          // Asegurar URL absoluta
          if (!imgUrl.startsWith('http')) {
            if (imgUrl.startsWith('//')) {
              imgUrl = `https:${imgUrl}`;
            } else if (imgUrl.startsWith('/')) {
              imgUrl = `https://somoskudasai.com${imgUrl}`;
            }
          }
          
          return imgUrl;
        }
      }
    }
    
    return null;
  }

  private isValidImageUrl(url: string): boolean {
    if (!url) return false;
    
    // Filtrar URLs no deseadas
    const invalidPatterns = [
      /gravatar\.com/i,
      /avatar/i,
      /logo/i,
      /icon/i,
      /banner/i,
      /ads\//i,
      /advertisement/i,
      /tracking/i,
      /analytics/i,
      /1x1/i,
      /pixel/i
    ];

    // Verificar que no sea una imagen muy pequeña o de tracking
    if (url.includes('1x1') || url.includes('pixel')) {
      return false;
    }

    // Verificar patrones inválidos
    for (const pattern of invalidPatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }

    // Verificar que sea una imagen válida
    const validExtensions = /\.(jpg|jpeg|png|gif|webp|svg)/i;
    return validExtensions.test(url) || url.includes('wp-content');
  }

  private cleanText(text: string): string {
    if (!text) return '';
    
    // Remover tags HTML y entidades
    return text
      .replace(/<[^>]*>/g, '') // Remover tags HTML
      .replace(/&[^;]+;/g, ' ') // Remover entidades HTML
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
  }

  private obtenerNoticiasSimuladas(): Observable<Noticia[]> {
    const noticiasSimuladas: Noticia[] = [
      {
        titulo: "Demon Slayer: Nuevo arco animado confirmado",
        descripcion: "El estudio Ufotable confirma la animación del próximo arco de Demon Slayer con nueva fecha de estreno para 2024.",
        imagen: "assets/images/palmeritachan.png",
        fecha: new Date().toISOString(),
        url: "https://somoskudasai.com",
        categoria: "Anime",
        autor: "Somos Kudasai"
      },
      {
        titulo: "Attack on Titan: Película final anunciada",
        descripcion: "Wit Studio anuncia una película que adaptará los últimos capítulos del manga de Attack on Titan.",
        imagen: "assets/images/palmeritachan.png",
        fecha: new Date(Date.now() - 3600000).toISOString(),
        url: "https://somoskudasai.com",
        categoria: "Anime",
        autor: "Somos Kudasai"
      },
      {
        titulo: "One Piece: Nuevo opening revelado",
        descripcion: "Toei Animation revela el nuevo opening de One Piece que acompañará el arco actual.",
        imagen: "assets/images/palmeritachan.png",
        fecha: new Date(Date.now() - 7200000).toISOString(),
        url: "https://somoskudasai.com",
        categoria: "Anime",
        autor: "Somos Kudasai"
      },
      {
        titulo: "¡Noticias de anime actualizadas!",
        descripcion: "Mantente al día con las últimas noticias del mundo del anime visitando Somos Kudasai.",
        imagen: "assets/images/palmeritachan.png",
        fecha: new Date(Date.now() - 10800000).toISOString(),
        url: "https://somoskudasai.com",
        categoria: "Información",
        autor: "Somos Kudasai"
      }
    ];

    return new Observable(subscriber => {
      setTimeout(() => {
        subscriber.next(noticiasSimuladas);
        subscriber.complete();
      }, 1000);
    });
  }

  private isDataFresh(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.cacheTimeout;
  }

  // Método para limpiar caché
  clearCache(): void {
    this.cache.clear();
  }

  // Método para refrescar noticias
  refreshNoticias(): void {
    this.obtenerNoticias(true).subscribe({
      error: (error) => console.error('Error refreshing noticias:', error)
    });
  }

  private getBestImage(item: any): string {
    // 1. Intentar obtener imagen del thumbnail (RSS2JSON)
    if (item.thumbnail && item.thumbnail.length > 0) {
      return item.thumbnail;
    }

    // 2. Intentar extraer imagen del contenido HTML
    if (item.content) {
      const imageFromContent = this.extractImageFromContent(item.content);
      if (imageFromContent) return imageFromContent;
    }

    // 3. Intentar extraer imagen de la descripción
    if (item.description) {
      const imageFromDescription = this.extractImageFromContent(item.description);
      if (imageFromDescription) return imageFromDescription;
    }

    // 4. Buscar en enclosure (para archivos multimedia)
    if (item.enclosure && item.enclosure.link) {
      return item.enclosure.link;
    }

    // 5. Buscar imágenes en campos personalizados de WordPress
    if (item['media:content'] && item['media:content']['@_url']) {
      return item['media:content']['@_url'];
    }

    // 6. Fallback a imagen por defecto
    return 'assets/images/palmeritachan.png';
  }
}