import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AnimeService } from '../../../managers/AnimeService';
import { TimezoneService } from '../../../managers/TimezoneService';

interface Episode {
  number: number;
  title?: string;
  image_url?: string;
  mal_id?: number;
}

@Component({
  selector: 'app-anime-detail',
  templateUrl: './anime-detail.page.html',
  styleUrls: ['./anime-detail.page.scss']
})
export class AnimeDetailPage implements OnInit {
  anime: any;
  episodes: Episode[] = [];
  displayedEpisodes: Episode[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  
  // Propiedades para manejo de episodios
  episodesPerPage: number = 12;
  currentPage: number = 1;
  episodesReversed: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private animeService: AnimeService,
    private timezoneService: TimezoneService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAnimeDetails(Number(id));
    }
  }

  loadAnimeDetails(id: number) {
    this.isLoading = true;
    this.error = null;
    this.anime = null; 
    
    this.animeService.getAnimeById(id).subscribe({
      next: (response: any) => {
        // Add null checks before accessing properties
        if (response && (response.data || response.mal_id)) {
          // Handle both direct anime object and wrapped response
          this.anime = response.data || response;
          
          // Asignar el ranking directamente desde el campo 'rank' del anime.
          // El campo 'rank' de la API Jikan es el ranking global.
          // Si 'rank' es null, 0, o no es un número, hasTopRank() lo manejará y no se mostrará.
          if (this.anime && typeof this.anime.rank === 'number' && this.anime.rank > 0) {
            this.anime.topRank = this.anime.rank;
            console.log('🏆 Ranking asignado directamente del anime:', this.anime.topRank, 'para:', this.anime.title);
          } else {
            // Si no hay un 'rank' válido (e.g., null, 0, o no es un número),
            // asegurar que topRank no tenga un valor residual de una carga anterior.
            if (this.anime) this.anime.topRank = null;
            console.log('ℹ️ Anime sin ranking directo o ranking no válido. Título:', this.anime?.title, 'Rank API:', this.anime?.rank);
          }

          // Cargar episodios después de cargar el anime
          this.loadEpisodes(id);

        } else {
          console.error('❌ Respuesta inválida del anime:', response);
          this.error = 'No se pudieron cargar los detalles del anime';
        }
        
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los detalles del anime';
        this.isLoading = false;
        this.anime = null; // Clear anime data on error
        console.error('Error:', err);
      }
    });
  }

  getImageUrl(): string {
    // Priorizar la imagen grande, luego la normal, y finalmente la de por defecto
    return this.anime?.images?.jpg?.large_image_url || 
           this.anime?.images?.jpg?.image_url || 
           'assets/default-image.png';
  }

  getGenres(): string {
    return this.anime?.genres?.map((genre: any) => genre.name).join(', ') || 'Desconocido';
  }

  hasTrailer(): boolean {
    return !!this.anime?.trailer?.url;
  }

  openTrailer() {
    if (this.anime?.trailer?.url) {
      window.open(this.anime.trailer.url, '_blank');
    }
  }

  // Métodos actualizados para fechas con zona horaria de Chile
  getAirDate(): { text: string; date: Date | null; type: 'aired' | 'airing' | 'upcoming' | 'unknown'; chileInfo?: string } {
    if (!this.anime) {
      return { text: 'Fecha desconocida', date: null, type: 'unknown' };
    }

    const status = this.anime.status?.toLowerCase();
    const airingStatus = this.anime.airing;

    // Usar fecha convertida a Chile si está disponible
    if (this.anime.aired_chile?.from_chile) {
      const chileDate = new Date(this.anime.aired_chile.from_chile);
      const formattedDate = this.anime.aired_chile.formatted_chile;
      if (status === 'not yet aired' || status === 'upcoming') {
        return {
          text: `Se estrena el ${formattedDate}`,
          date: chileDate,
          type: 'upcoming',
          chileInfo: 'Fecha convertida a horario chileno'
        };
      } else if (airingStatus) {
        return {
          text: `En emisión desde ${formattedDate}`,
          date: chileDate,
          type: 'airing',
          chileInfo: 'Fecha convertida a horario chileno'
        };
      } else {
        return {
          text: `Se estrenó el ${formattedDate}`,
          date: chileDate,
          type: 'aired',
          chileInfo: 'Fecha convertida a horario chileno'
        };
      }
    }

    // Fallback a fecha original si no hay conversión
    if (this.anime.aired?.from) {
      const fromDate = new Date(this.anime.aired.from);
      return {
        text: `Se estrena el ${this.formatDate(fromDate)}`,
        date: fromDate,
        type: 'upcoming'
      };
    }

    // Información de broadcast con zona horaria chilena
    if (this.anime.broadcast_chile?.chile && status === 'currently airing') {
      const broadcastInfo = this.anime.broadcast_chile;
      let text = `En emisión los ${broadcastInfo.chile.day}`;
      if (broadcastInfo.chile.time) {
        text += ` a las ${broadcastInfo.chile.time}`;
      }
      if (broadcastInfo.chile.day_changed) {
        text += ` (originalmente ${this.timezoneService.translateDay(broadcastInfo.original.day)} en Japón)`;
      }
      return {
        text,
        date: null,
        type: 'airing',
        chileInfo: 'Horario convertido a zona horaria de Chile'
      };
    }

    // Casos por estado
    switch (status) {
      case 'not yet aired':
      case 'upcoming':
        return { text: 'Próximamente', date: null, type: 'upcoming' };
      case 'currently airing':
        return { text: 'En emisión', date: null, type: 'airing' };
      case 'finished airing':
        return { text: 'Finalizado', date: null, type: 'aired' };
      default:
        return { text: 'Fecha desconocida', date: null, type: 'unknown' };
    }
  }

  // Método para obtener información adicional de zona horaria
  getBroadcastInfo(): { original?: string; chile?: string; explanation?: string } | null {
    if (!this.anime?.broadcast_chile) {
      return null;
    }

    const broadcast = this.anime.broadcast_chile;
    
    return {
      original: broadcast.original ? `${this.timezoneService.translateDay(broadcast.original.day)} ${broadcast.original.time || ''} (Japón)` : undefined,
      chile: broadcast.chile ? `${broadcast.chile.day} ${broadcast.chile.time || ''} (Chile)` : undefined,
      explanation: broadcast.timezone_info
    };
  }

  // Método para verificar si hay cambio de día por zona horaria
  hasDayChanged(): boolean {
    return this.anime?.broadcast_chile?.chile?.day_changed || false;
  }

  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Santiago' // Usar zona horaria de Chile
    };
    return date.toLocaleDateString('es-CL', options);
  }

  getEpisodeInfo(): string {
    if (!this.anime) return '';
    
    const episodes = this.anime.episodes;
    const duration = this.anime.duration;
    
    let info = '';
    
    if (episodes) {
      info += `${episodes} episodios`;
    }
    
    if (duration) {
      if (info) info += ' • ';
      info += duration;
    }
    
    return info;
  }

  getScore(): string {
    if (this.anime?.score) {
      return `★ ${this.anime.score}/10`;
    }
    return '';
  }

  // NUEVO: Método para obtener información del ranking
  getTopRankInfo(): string {
    if (this.anime?.topRank && this.anime.topRank > 0) {
      return `#${this.anime.topRank}`; // Texto simplificado para mostrar solo el número del ranking
    }
    return '';
  }

  // NUEVO: Método para verificar si tiene ranking
  hasTopRank(): boolean {
    const hasRank = !!(this.anime?.topRank && this.anime.topRank > 0); // Asegura que topRank sea un número positivo
    console.log('🏆 ¿Tiene ranking?', hasRank, 'Anime:', this.anime?.title, 'Rank:', this.anime?.topRank);
    return hasRank;
  }

  // NUEVOS MÉTODOS PARA MANEJO DE EPISODIOS

  loadEpisodes(animeId: number) {
    // Crear episodios simulados basados en el número total de episodios
    if (this.anime?.episodes) {
      this.episodes = [];
      const totalEpisodes = this.anime.episodes;
      
      for (let i = 1; i <= totalEpisodes; i++) {
        this.episodes.push({
          number: i,
          title: `Episodio ${i}`,
          image_url: this.getEpisodeImageUrl({ number: i })
        });
      }
      
      this.updateDisplayedEpisodes();
    }
  }

  getDisplayedEpisodes(): Episode[] {
    return this.displayedEpisodes;
  }

  updateDisplayedEpisodes() {
    const startIndex = 0;
    const endIndex = this.currentPage * this.episodesPerPage;
    
    let episodesToShow = this.episodesReversed 
      ? [...this.episodes].reverse() 
      : this.episodes;
    
    this.displayedEpisodes = episodesToShow.slice(startIndex, endIndex);
  }

  getEpisodeImageUrl(episode: Episode): string {
    // Generar URL de imagen del episodio basada en el anime
    if (episode.image_url) {
      return episode.image_url;
    }
    
    // URL por defecto o basada en la imagen del anime
    const baseImage = this.anime?.images?.jpg?.large_image_url || this.anime?.images?.jpg?.image_url;
    if (baseImage) {
      return baseImage; // Usar la misma imagen del anime como placeholder
    }
    
    return 'assets/default-episode.png';
  }

  toggleEpisodesOrder() {
    this.episodesReversed = !this.episodesReversed;
    this.updateDisplayedEpisodes();
  }

  searchEpisodes() {
    // Por ahora, simplemente mostrar un mensaje
    console.log('Función de búsqueda de episodios - por implementar');
    // Aquí se podría implementar un modal de búsqueda
  }

  hasMoreEpisodes(): boolean {
    const totalShown = this.currentPage * this.episodesPerPage;
    return totalShown < this.episodes.length;
  }

  loadMoreEpisodes() {
    if (this.hasMoreEpisodes()) {
      this.currentPage++;
      this.updateDisplayedEpisodes();
    }
  }

  watchEpisode(episode: Episode) {
    console.log('Ver episodio:', episode.number, 'del anime:', this.anime?.title);
    
    // Navegar a la página de visualización del episodio
    // Usando el ID del anime y el número del episodio
    const animeId = this.route.snapshot.paramMap.get('id');
    if (animeId) {
      // Por ahora, vamos a crear una ruta como /watch/animeId/episodeNumber
      this.router.navigate(['/watch', animeId, episode.number]);
    }
  }
}