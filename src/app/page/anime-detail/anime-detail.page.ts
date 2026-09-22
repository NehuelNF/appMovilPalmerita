import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AnimeService } from '../../../managers/AnimeService';
import { TimezoneService } from '../../../managers/TimezoneService';
import { WatchProgressService, WatchProgress } from '../../../managers/WatchProgressService';

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
export class AnimeDetailPage implements OnInit, OnDestroy {
  anime: any;
  episodes: Episode[] = [];
  displayedEpisodes: Episode[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  
  // Propiedades para manejo de episodios
  episodesPerPage: number = 12;
  currentPage: number = 1;
  episodesReversed: boolean = false;

  // Watch Progress
  watchProgress: WatchProgress | null = null;
  watchedEpisodesSet = new Set<number>();
  private progressSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private animeService: AnimeService,
    private timezoneService: TimezoneService,
    private watchProgressService: WatchProgressService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAnimeDetails(Number(id));
      this.subscribeToWatchProgress(Number(id));
    }
  }

  ngOnDestroy() {
    if (this.progressSub) {
      this.progressSub.unsubscribe();
    }
  }

  private subscribeToWatchProgress(animeId: number) {
    if (this.progressSub) this.progressSub.unsubscribe();
    this.progressSub = this.watchProgressService.getProgress(animeId).subscribe(progress => {
      this.watchProgress = progress;
      if (progress && Array.isArray(progress.watchedEpisodes)) {
        this.watchedEpisodesSet = new Set(progress.watchedEpisodes);
      } else {
        this.watchedEpisodesSet.clear();
      }
    });
  }

  isEpisodeWatched(episodeNumber: number): boolean {
    return this.watchedEpisodesSet.has(episodeNumber);
  }

  async toggleEpisodeWatched(episode: Episode, event: Event) {
    event.stopPropagation();
    try {
      const isWatched = !this.isEpisodeWatched(episode.number);

      let uncompletedPreviousCount = 0;
      if (isWatched && episode.number > 1) {
        for (let i = 1; i < episode.number; i++) {
          if (!this.watchedEpisodesSet.has(i)) uncompletedPreviousCount++;
        }
      }

      if (isWatched && uncompletedPreviousCount > 0) {
        const alert = await this.alertCtrl.create({
          header: '¿Marcar capítulos anteriores?',
          message: `Vas en el capítulo ${episode.number} y tienes ${uncompletedPreviousCount} capítulo(s) anterior(es) sin marcar como visto. ¿Deseas marcarlos también como vistos?`,
          buttons: [
            {
              text: 'Solo este capítulo',
              role: 'cancel',
              handler: () => {
                void this.executeToggleWatched(episode.number, isWatched, false);
              }
            },
            {
              text: 'Marcar todos los anteriores',
              handler: () => {
                void this.executeToggleWatched(episode.number, isWatched, true);
              }
            }
          ]
        });
        await alert.present();
      } else {
        await this.executeToggleWatched(episode.number, isWatched, false);
      }
    } catch (err: any) {
      const toast = await this.toastCtrl.create({
        message: err.message || 'Inicia sesión para guardar tu progreso',
        duration: 2500,
        color: 'warning'
      });
      await toast.present();
    }
  }

  private async executeToggleWatched(episodeNumber: number, isWatched: boolean, markPrevious: boolean) {
    const res = await this.watchProgressService.toggleEpisodeWatched(
      this.anime,
      episodeNumber,
      isWatched,
      markPrevious
    );

    if (isWatched) {
      this.watchedEpisodesSet.add(episodeNumber);
      if (markPrevious && episodeNumber > 1) {
        for (let i = 1; i < episodeNumber; i++) {
          this.watchedEpisodesSet.add(i);
        }
      }
    } else {
      this.watchedEpisodesSet.delete(episodeNumber);
    }

    const toastMsg = isWatched
      ? (markPrevious && res.addedPreviousCount > 0
          ? `Capítulo ${episodeNumber} y ${res.addedPreviousCount} anteriores marcados como vistos ✓`
          : `Episodio ${episodeNumber} marcado como visto ✓`)
      : `Episodio ${episodeNumber} desmarcado`;

    const toast = await this.toastCtrl.create({
      message: toastMsg,
      duration: 2500,
      color: isWatched ? 'success' : 'medium',
      position: 'bottom'
    });
    await toast.present();
  }

  getResumeEpisodeNumber(): number {
    if (!this.watchProgress) return 1;
    const last = this.watchProgress.lastEpisode || 1;
    return last;
  }

  loadAnimeDetails(id: number) {
    this.isLoading = true;
    this.error = null;
    this.anime = null; 
    
    this.animeService.getAnimeById(id).subscribe({
      next: (response: any) => {
        if (response && (response.data || response.mal_id)) {
          this.anime = response.data || response;
          
          if (this.anime && typeof this.anime.rank === 'number' && this.anime.rank > 0) {
            this.anime.topRank = this.anime.rank;
          } else {
            if (this.anime) this.anime.topRank = null;
          }

          this.loadEpisodes(id);
        } else {
          this.error = 'No se pudieron cargar los detalles del anime';
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los detalles del anime';
        this.isLoading = false;
        this.anime = null;
      }
    });
  }

  getImageUrl(): string {
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

  getAirDate(): { text: string; date: Date | null; type: 'aired' | 'airing' | 'upcoming' | 'unknown'; chileInfo?: string } {
    if (!this.anime) {
      return { text: 'Fecha desconocida', date: null, type: 'unknown' };
    }

    const status = this.anime.status?.toLowerCase();
    const airingStatus = this.anime.airing;

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

    if (this.anime.aired?.from) {
      const fromDate = new Date(this.anime.aired.from);
      return {
        text: `Se estrena el ${this.formatDate(fromDate)}`,
        date: fromDate,
        type: 'upcoming'
      };
    }

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

  getBroadcastInfo(): { original?: string; chile?: string; explanation?: string } | null {
    if (!this.anime?.broadcast_chile) return null;
    const broadcast = this.anime.broadcast_chile;
    return {
      original: broadcast.original ? `${this.timezoneService.translateDay(broadcast.original.day)} ${broadcast.original.time || ''} (Japón)` : undefined,
      chile: broadcast.chile ? `${broadcast.chile.day} ${broadcast.chile.time || ''} (Chile)` : undefined,
      explanation: broadcast.timezone_info
    };
  }

  hasDayChanged(): boolean {
    return this.anime?.broadcast_chile?.chile?.day_changed || false;
  }

  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Santiago'
    };
    return date.toLocaleDateString('es-CL', options);
  }

  getEpisodeInfo(): string {
    if (!this.anime) return '';
    const episodes = this.anime.episodes;
    const duration = this.anime.duration;
    let info = '';
    if (episodes) info += `${episodes} episodios`;
    if (duration) {
      if (info) info += ' • ';
      info += duration;
    }
    return info;
  }

  getScore(): string {
    if (this.anime?.score) return `★ ${this.anime.score}/10`;
    return '';
  }

  getTopRankInfo(): string {
    if (this.anime?.topRank && this.anime.topRank > 0) {
      return `#${this.anime.topRank}`;
    }
    return '';
  }

  hasTopRank(): boolean {
    return !!(this.anime?.topRank && this.anime.topRank > 0);
  }

  loadEpisodes(animeId: number) {
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
    if (episode.image_url) return episode.image_url;
    const baseImage = this.anime?.images?.jpg?.large_image_url || this.anime?.images?.jpg?.image_url;
    if (baseImage) return baseImage;
    return 'assets/default-episode.png';
  }

  toggleEpisodesOrder() {
    this.episodesReversed = !this.episodesReversed;
    this.updateDisplayedEpisodes();
  }

  searchEpisodes() {}

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
    const animeId = this.route.snapshot.paramMap.get('id');
    if (animeId) {
      this.router.navigate(['/watch', animeId, episode.number]);
    }
  }

  resumeWatching() {
    const epNum = this.getResumeEpisodeNumber();
    const animeId = this.route.snapshot.paramMap.get('id');
    if (animeId) {
      this.router.navigate(['/watch', animeId, epNum]);
    }
  }
}