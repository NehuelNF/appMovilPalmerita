import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AnimeService } from '../../../managers/AnimeService';
import { TimezoneService } from '../../../managers/TimezoneService';

@Component({
  selector: 'app-anime-detail',
  templateUrl: './anime-detail.page.html',
  styleUrls: ['./anime-detail.page.scss']
})
export class AnimeDetailPage implements OnInit {
  anime: any;
  isLoading: boolean = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
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
    this.animeService.getAnimeById(id).subscribe({
      next: (response: any) => {
        this.anime = response.data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los detalles del anime';
        this.isLoading = false;
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
}