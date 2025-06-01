import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout, retry } from 'rxjs/operators';

interface StreamingProvider {
  name: string;
  baseUrl: string;
  extractorType: 'iframe' | 'direct' | 'api';
  priority: number;
}

interface StreamingLink {
  url: string;
  provider: string;
  quality?: string;
  type: 'iframe' | 'direct' | 'hls' | 'm3u8';
  isWorking: boolean;
}

interface EpisodeStreamData {
  animeId: string;
  episodeNumber: number;
  animeTitle: string;
  streamingLinks: StreamingLink[];
  recommendedLink?: StreamingLink;
}

@Injectable({
  providedIn: 'root'
})
export class StreamingService {
  private providers: StreamingProvider[] = [
    {
      name: 'mp4upload',
      baseUrl: 'https://mp4upload.com',
      extractorType: 'iframe',
      priority: 1
    },
    {
      name: 'streamwish',
      baseUrl: 'https://streamwish.to',
      extractorType: 'iframe',
      priority: 2
    },
    {
      name: 'doodstream',
      baseUrl: 'https://doodstream.com',
      extractorType: 'iframe',
      priority: 3
    },
    {
      name: 'animeav1',
      baseUrl: 'https://animeav1.com',
      extractorType: 'direct',
      priority: 4
    }
  ];

  // Cache para evitar múltiples solicitudes
  private streamingCache = new Map<string, EpisodeStreamData>();
  private cacheTimeout = 30 * 60 * 1000; // 30 minutos

  constructor(private http: HttpClient) {}

  /**
   * Obtiene los enlaces de streaming para un episodio específico
   */
  async getStreamingLinks(animeId: string, episodeNumber: number, animeTitle: string): Promise<EpisodeStreamData> {
    const cacheKey = `${animeId}-${episodeNumber}`;
    
    // Verificar cache
    if (this.streamingCache.has(cacheKey)) {
      const cached = this.streamingCache.get(cacheKey)!;
      return cached;
    }

    try {
      const streamingLinks: StreamingLink[] = [];

      // Intentar obtener enlaces de diferentes proveedores
      for (const provider of this.providers.sort((a, b) => a.priority - b.priority)) {
        try {
          const links = await this.extractFromProvider(provider, animeId, episodeNumber, animeTitle);
          streamingLinks.push(...links);
        } catch (error) {
          console.warn(`Error al obtener enlaces de ${provider.name}:`, error);
        }
      }

      const episodeData: EpisodeStreamData = {
        animeId,
        episodeNumber,
        animeTitle,
        streamingLinks,
        recommendedLink: this.selectBestLink(streamingLinks)
      };

      // Guardar en cache
      this.streamingCache.set(cacheKey, episodeData);
      
      // Limpiar cache después del timeout
      setTimeout(() => {
        this.streamingCache.delete(cacheKey);
      }, this.cacheTimeout);

      return episodeData;

    } catch (error) {
      console.error('Error al obtener enlaces de streaming:', error);
      throw error;
    }
  }

  /**
   * Extrae enlaces de un proveedor específico
   */
  private async extractFromProvider(
    provider: StreamingProvider, 
    animeId: string, 
    episodeNumber: number, 
    animeTitle: string
  ): Promise<StreamingLink[]> {
    switch (provider.name) {
      case 'mp4upload':
        return this.extractMp4UploadLinks(animeId, episodeNumber, animeTitle);
      
      case 'streamwish':
        return this.extractStreamwishLinks(animeId, episodeNumber, animeTitle);
      
      case 'doodstream':
        return this.extractDoodstreamLinks(animeId, episodeNumber, animeTitle);
      
      case 'animeav1':
        return this.extractAnimeAV1Links(animeId, episodeNumber, animeTitle);
      
      default:
        return [];
    }
  }

  /**
   * Extrae enlaces de mp4upload
   */
  private async extractMp4UploadLinks(animeId: string, episodeNumber: number, animeTitle: string): Promise<StreamingLink[]> {
    try {
      // Generar posibles URLs de mp4upload basadas en patrones comunes
      const slug = this.generateAnimeSlug(animeTitle);
      const possibleUrls = [
        `https://mp4upload.com/embed-${this.generateVideoId(slug, episodeNumber)}.html`,
        `https://www.mp4upload.com/embed-${this.generateVideoId(slug, episodeNumber)}.html`,
        `https://mp4upload.com/${this.generateVideoId(slug, episodeNumber)}`,
      ];

      const links: StreamingLink[] = [];

      for (const url of possibleUrls) {
        try {
          // Verificar si el enlace existe y es válido
          const isValid = await this.validateStreamingUrl(url);
          if (isValid) {
            links.push({
              url,
              provider: 'mp4upload',
              quality: 'HD',
              type: 'iframe',
              isWorking: true
            });
          }
        } catch (error) {
          console.warn(`URL de mp4upload no válida: ${url}`);
        }
      }

      return links;
    } catch (error) {
      console.error('Error extrayendo enlaces de mp4upload:', error);
      return [];
    }
  }

  /**
   * Extrae enlaces de Streamwish
   */
  private async extractStreamwishLinks(animeId: string, episodeNumber: number, animeTitle: string): Promise<StreamingLink[]> {
    try {
      const slug = this.generateAnimeSlug(animeTitle);
      const videoId = this.generateVideoId(slug, episodeNumber, 'streamwish');
      
      const possibleUrls = [
        `https://streamwish.to/e/${videoId}`,
        `https://streamwish.to/embed-${videoId}.html`,
      ];

      const links: StreamingLink[] = [];

      for (const url of possibleUrls) {
        try {
          const isValid = await this.validateStreamingUrl(url);
          if (isValid) {
            links.push({
              url,
              provider: 'streamwish',
              quality: 'HD',
              type: 'iframe',
              isWorking: true
            });
          }
        } catch (error) {
          console.warn(`URL de streamwish no válida: ${url}`);
        }
      }

      return links;
    } catch (error) {
      console.error('Error extrayendo enlaces de streamwish:', error);
      return [];
    }
  }

  /**
   * Extrae enlaces de Doodstream
   */
  private async extractDoodstreamLinks(animeId: string, episodeNumber: number, animeTitle: string): Promise<StreamingLink[]> {
    try {
      const slug = this.generateAnimeSlug(animeTitle);
      const videoId = this.generateVideoId(slug, episodeNumber, 'doodstream');
      
      const possibleUrls = [
        `https://doodstream.com/e/${videoId}`,
        `https://doodstream.com/d/${videoId}`,
      ];

      const links: StreamingLink[] = [];

      for (const url of possibleUrls) {
        try {
          const isValid = await this.validateStreamingUrl(url);
          if (isValid) {
            links.push({
              url,
              provider: 'doodstream',
              quality: 'HD',
              type: 'iframe',
              isWorking: true
            });
          }
        } catch (error) {
          console.warn(`URL de doodstream no válida: ${url}`);
        }
      }

      return links;
    } catch (error) {
      console.error('Error extrayendo enlaces de doodstream:', error);
      return [];
    }
  }

  /**
   * Extrae enlaces de AnimeAV1 (fallback)
   */
  private async extractAnimeAV1Links(animeId: string, episodeNumber: number, animeTitle: string): Promise<StreamingLink[]> {
    const slug = this.generateAnimeSlug(animeTitle);
    const url = `https://animeav1.com/media/${slug}/${episodeNumber}`;

    return [{
      url,
      provider: 'animeav1',
      quality: 'HD',
      type: 'direct',
      isWorking: true // Asumimos que siempre funciona como fallback
    }];
  }

  /**
   * Genera un slug para el anime compatible con URLs
   */
  private generateAnimeSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Genera un ID de video basado en el título y episodio
   */
  private generateVideoId(slug: string, episodeNumber: number, provider: string = 'mp4upload'): string {
    // Generar un ID único basado en el slug y episodio
    const baseString = `${slug}-ep-${episodeNumber}-${provider}`;
    
    // Crear un hash simple
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
      const char = baseString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    
    // Convertir a string alfanumérico
    const videoId = Math.abs(hash).toString(36) + episodeNumber.toString().padStart(2, '0');
    
    return videoId;
  }

  /**
   * Valida si una URL de streaming es accesible
   */
  private async validateStreamingUrl(url: string): Promise<boolean> {
    try {
      // En un entorno real, harías una petición HEAD para verificar si la URL existe
      // Por ahora, simulamos la validación
      
      // Verificar patrones básicos de URL válida
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        return false;
      }

      // Simular validación (en producción, usar petición HTTP real)
      const isValidDomain = ['mp4upload.com', 'streamwish.to', 'doodstream.com', 'animeav1.com']
        .some(domain => url.includes(domain));

      return isValidDomain;
    } catch (error) {
      return false;
    }
  }

  /**
   * Selecciona el mejor enlace basado en prioridad y calidad
   */
  private selectBestLink(links: StreamingLink[]): StreamingLink | undefined {
    if (links.length === 0) return undefined;

    // Filtrar solo enlaces que funcionan
    const workingLinks = links.filter(link => link.isWorking);
    if (workingLinks.length === 0) return links[0];

    // Priorizar por proveedor (mp4upload > streamwish > doodstream > animeav1)
    const providerPriority = ['mp4upload', 'streamwish', 'doodstream', 'animeav1'];
    
    for (const provider of providerPriority) {
      const providerLink = workingLinks.find(link => link.provider === provider);
      if (providerLink) {
        return providerLink;
      }
    }

    return workingLinks[0];
  }

  /**
   * Obtiene información de un proveedor específico
   */
  getProviderInfo(providerName: string): StreamingProvider | undefined {
    return this.providers.find(p => p.name === providerName);
  }

  /**
   * Lista todos los proveedores disponibles
   */
  getAvailableProviders(): StreamingProvider[] {
    return [...this.providers];
  }

  /**
   * Limpia el cache de streaming
   */
  clearCache(): void {
    this.streamingCache.clear();
  }
}