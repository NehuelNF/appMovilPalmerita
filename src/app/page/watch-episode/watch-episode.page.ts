import { Component, OnDestroy, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastController, AlertController } from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { AnimeService } from '../../../managers/AnimeService';
import { WatchProgressService, WatchProgress } from '../../../managers/WatchProgressService';

interface Player {
  name: string;
  url: string;
  type?: 'direct' | 'iframe';
  audio?: 'sub' | 'dub';
  provider?: 'animeav1' | 'jkanime' | string;
}

@Component({
  selector: 'app-watch-episode',
  templateUrl: './watch-episode.page.html',
  styleUrls: ['./watch-episode.page.scss']
})
export class WatchEpisodePage implements OnInit, OnDestroy {
  readonly isIphone = /iPhone/i.test(navigator.userAgent);
  animeId = '';
  episodeNumber = 1;
  animeTitle = '';
  episodeTitle = '';
  episodeThumbnail = '';
  anime: any = null;
  totalEpisodes = 0;
  maxAiredEpisode = 0;
  episodes: { number: number; title: string; isAired?: boolean }[] = [];
  safeIframeUrl: SafeResourceUrl | null = null;
  streamingError = '';
  isNotReleased = false;
  loading = true;
  players: Player[] = [];
  selectedAudio: 'sub' | 'dub' = 'sub';
  selectedPlayer = '';
  selectedProvider: 'all' | 'animeav1' | 'jkanime' = 'all';
  private failedPlayerUrls = new Set<string>();
  sourceUrl = '';
  directVideoUrl = '';
  showAllEpisodes = false;

  // Seguimiento de progreso
  watchedEpisodesSet = new Set<number>();
  isCurrentEpisodeWatched = false;
  lastSavedPosition = 0;
  private progressSub?: Subscription;
  private lastSaveTime = 0;

  @ViewChild('playerSurface') playerSurface?: ElementRef<HTMLElement>;
  @ViewChild('nativeVideo') nativeVideo?: ElementRef<HTMLVideoElement>;
  expanded = false;
  fullscreenMessage = '';

  private generation = 0;
  private subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private animeService: AnimeService,
    private watchProgressService: WatchProgressService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private location: Location
  ) {}

  async toggleFullscreen() {
    if (this.isIphone && this.nativeVideo?.nativeElement) {
      const video = this.nativeVideo.nativeElement as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
    }
    const element = this.playerSurface?.nativeElement;
    if (!element) return;
    if (document.fullscreenElement === element) { await document.exitFullscreen(); return; }
    if (this.expanded) { this.expanded = false; this.fullscreenMessage = ''; return; }
    try {
      if (!document.fullscreenEnabled || !element.requestFullscreen) throw new Error('Unavailable');
      await element.requestFullscreen();
    } catch {
      this.expanded = true;
      this.fullscreenMessage = 'Vista completa activa. Usa el botón Salir para volver.';
    }
  }

  @HostListener('document:keydown.escape') closeExpanded() {
    this.expanded = false;
    this.fullscreenMessage = '';
  }

  ngOnInit() {
    this.subscription = this.route.params.subscribe(params => {
      this.animeId = params['animeId'];
      this.episodeNumber = Number(params['episodeNumber']);
      this.subscribeToWatchProgress();
      void this.loadEpisode();
    });
  }

  private subscribeToWatchProgress() {
    if (this.progressSub) this.progressSub.unsubscribe();
    this.progressSub = this.watchProgressService.getProgress(this.animeId).subscribe(progress => {
      if (progress && Array.isArray(progress.watchedEpisodes)) {
        this.watchedEpisodesSet = new Set(progress.watchedEpisodes);
        this.isCurrentEpisodeWatched = this.watchedEpisodesSet.has(this.episodeNumber);
        if (progress.playbackPositions && progress.playbackPositions[String(this.episodeNumber)]) {
          this.lastSavedPosition = progress.playbackPositions[String(this.episodeNumber)];
        }
      } else {
        this.watchedEpisodesSet.clear();
        this.isCurrentEpisodeWatched = false;
        this.lastSavedPosition = 0;
      }
    });
  }

  isEpisodeWatched(epNumber: number): boolean {
    return this.watchedEpisodesSet.has(epNumber);
  }

  async toggleCurrentWatched() {
    try {
      const newState = !this.isCurrentEpisodeWatched;

      let uncompletedPreviousCount = 0;
      if (newState && this.episodeNumber > 1) {
        for (let i = 1; i < this.episodeNumber; i++) {
          if (!this.watchedEpisodesSet.has(i)) uncompletedPreviousCount++;
        }
      }

      if (newState && uncompletedPreviousCount > 0) {
        const alert = await this.alertCtrl.create({
          header: '¿Marcar capítulos anteriores?',
          message: `Vas en el capítulo ${this.episodeNumber} y tienes ${uncompletedPreviousCount} capítulo(s) anterior(es) sin marcar como visto. ¿Deseas marcarlos también como vistos?`,
          buttons: [
            {
              text: 'Solo este capítulo',
              role: 'cancel',
              handler: () => {
                void this.executeToggleWatched(newState, false);
              }
            },
            {
              text: 'Marcar todos los anteriores',
              handler: () => {
                void this.executeToggleWatched(newState, true);
              }
            }
          ]
        });
        await alert.present();
      } else {
        await this.executeToggleWatched(newState, false);
      }
    } catch (err: any) {
      const toast = await this.toastCtrl.create({
        message: err.message || 'Error al actualizar progreso',
        duration: 2500,
        color: 'warning'
      });
      await toast.present();
    }
  }

  private async executeToggleWatched(newState: boolean, markPrevious: boolean) {
    const res = await this.watchProgressService.toggleEpisodeWatched(
      this.anime || { id: this.animeId, title: this.animeTitle },
      this.episodeNumber,
      newState,
      markPrevious
    );

    this.isCurrentEpisodeWatched = newState;
    if (newState) {
      this.watchedEpisodesSet.add(this.episodeNumber);
      if (markPrevious && this.episodeNumber > 1) {
        for (let i = 1; i < this.episodeNumber; i++) {
          this.watchedEpisodesSet.add(i);
        }
      }
    } else {
      this.watchedEpisodesSet.delete(this.episodeNumber);
    }

    const toastMsg = newState
      ? (markPrevious && res.addedPreviousCount > 0
          ? `Capítulo ${this.episodeNumber} y ${res.addedPreviousCount} anteriores marcados como vistos ✓`
          : `Episodio ${this.episodeNumber} marcado como visto ✓`)
      : `Episodio ${this.episodeNumber} marcado como pendiente`;

    const toast = await this.toastCtrl.create({
      message: toastMsg,
      duration: 2500,
      color: newState ? 'success' : 'medium',
      position: 'bottom'
    });
    await toast.present();
  }

  async onVideoLoadedMetadata(video: HTMLVideoElement) {
    if (this.lastSavedPosition > 0 && this.lastSavedPosition < (video.duration - 5)) {
      video.currentTime = this.lastSavedPosition;
      const toast = await this.toastCtrl.create({
        message: `Reanudando desde el minuto ${Math.floor(this.lastSavedPosition / 60)}:${String(Math.floor(this.lastSavedPosition % 60)).padStart(2, '0')}`,
        duration: 2500,
        color: 'primary',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  onVideoTimeUpdate(video: HTMLVideoElement) {
    const now = Date.now();
    // Throttle Firestore updates to every 6 seconds
    if (now - this.lastSaveTime > 6000 && !video.paused) {
      this.lastSaveTime = now;
      this.watchProgressService.savePlaybackPosition(
        this.anime || { id: this.animeId, title: this.animeTitle },
        this.episodeNumber,
        video.currentTime,
        video.duration
      ).then(autoCompleted => {
        if (autoCompleted) {
          this.isCurrentEpisodeWatched = true;
          this.watchedEpisodesSet.add(this.episodeNumber);
          this.toastCtrl.create({
            message: `¡Capítulo ${this.episodeNumber} completado (>85%)!`,
            duration: 2500,
            color: 'success',
            position: 'bottom'
          }).then(t => t.present());
        }
      }).catch(() => {});
    }
  }

  onVideoEnded(video: HTMLVideoElement) {
    this.watchProgressService.toggleEpisodeWatched(
      this.anime || { id: this.animeId, title: this.animeTitle },
      this.episodeNumber,
      true
    ).then(() => {
      this.isCurrentEpisodeWatched = true;
      this.watchedEpisodesSet.add(this.episodeNumber);
    }).catch(() => {});
  }

  async loadEpisode(useEnglish = false) {
    const generation = ++this.generation;
    const animeId = this.animeId, episode = this.episodeNumber;
    this.safeIframeUrl = null;
    this.directVideoUrl = '';
    this.players = [];
    this.failedPlayerUrls.clear();
    this.streamingError = '';
    this.isNotReleased = false;
    this.loading = true;
    this.sourceUrl = '';
    this.episodeTitle = 'Episodio ' + episode;

    try {
      if (!this.anime || this.anime.mal_id !== Number(animeId)) {
        const response: any = await firstValueFrom(this.animeService.getAnimeById(Number(animeId)));
        if (generation !== this.generation) return;
        this.anime = response.data || response;
      }
      this.animeTitle = this.anime.title || '';
      this.totalEpisodes = this.anime.totalEpisodes || this.anime.episodes || 0;
      this.maxAiredEpisode = this.anime.airedEpisodes !== undefined && this.anime.airedEpisodes !== null 
        ? this.anime.airedEpisodes 
        : this.totalEpisodes;

      const count = this.totalEpisodes || this.maxAiredEpisode || 0;
      this.episodes = Array.from({ length: count }, (_, i) => ({
        number: i + 1,
        title: 'Episodio ' + (i + 1),
        isAired: this.maxAiredEpisode > 0 ? (i + 1 <= this.maxAiredEpisode) : true
      }));
      this.episodeThumbnail = this.anime.images?.jpg?.large_image_url || 'assets/icon/favicon.png';

      // Registrar que se abrió el episodio en progreso
      void this.watchProgressService.recordEpisodeOpen(this.anime, this.episodeNumber);

      // Verificar si el capítulo solicitado aún no se ha emitido
      if (this.maxAiredEpisode > 0 && episode > this.maxAiredEpisode) {
        this.isNotReleased = true;
        this.streamingError = `El episodio ${episode} aún no ha salido. Actualmente hay ${this.maxAiredEpisode} capítulos emitidos.`;
        return;
      }

      const querySlug = this.route.snapshot.queryParams['slug'];
      const candidateSlugs: string[] = [];
      let jkSlug = '';
      const titles = useEnglish
        ? [this.anime.title_english, this.animeTitle, this.anime.title_romaji]
        : [this.animeTitle, this.anime.title_romaji, this.anime.title_english];
      if (Number.isSafeInteger(Number(animeId))) {
        try {
          const media = await firstValueFrom(this.animeService.getAnimeMedia(Number(animeId), titles.filter(Boolean)));
          if (media.slug) candidateSlugs.push(media.slug);
          jkSlug = media.sources?.jkanime || '';
        } catch { /* The title-based fallback remains available. */ }
      }
      if (querySlug && !candidateSlugs.includes(querySlug)) candidateSlugs.push(querySlug);
      for (const title of titles) {
        for (const candidate of this.animeService.getStreamingSlugs(title || '')) {
          if (!candidateSlugs.includes(candidate)) candidateSlugs.push(candidate);
        }
      }

      let slug = candidateSlugs[0] || '';
      this.sourceUrl = 'https://animeav1.com/media/' + slug + '/' + episode;
      let result: { players: Player[]; sourceUrl: string } | null = null;
      let lastError: any;
      for (const candidate of candidateSlugs) {
        try {
          result = await firstValueFrom(this.http.get<{ players: Player[]; sourceUrl: string }>('/api/player', {
            params: { slug: candidate, jkSlug: jkSlug || candidate, episode: String(episode) }
          }));
          slug = candidate;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!result) throw lastError || new Error('Sin reproductores disponibles.');

      if (generation !== this.generation) return;
      this.players = result.players;
      this.sourceUrl = result.sourceUrl;
      if (!this.players.length) throw new Error('Sin reproductores disponibles.');
      if (!this.playablePlayers.length) {
        this.streamingError = 'Los servidores de este capítulo no son compatibles con este dispositivo. Prueba el capítulo en su página de origen.';
        return;
      }

      // Seleccionar automáticamente el mejor reproductor para el idioma actual
      this.autoSelectBestPlayerForCurrentAudio();
    } catch (error: any) {
      if (generation !== this.generation) return;
      if (error?.status === 404 || error?.error?.notReleased) {
        this.isNotReleased = true;
        this.streamingError = error?.error?.error || `El episodio ${episode} aún no está disponible para su reproducción.`;
      } else {
        this.streamingError = error?.error?.error || 'No se pudo obtener el reproductor del capítulo.';
      }
    } finally {
      if (generation === this.generation) this.loading = false;
    }
  }

  get displayedPlayers(): Player[] {
    let list = this.playablePlayers.filter(p => (p.audio || 'sub') === this.selectedAudio);
    if (!list.length) list = this.playablePlayers;

    if (this.selectedProvider !== 'all') {
      const filtered = list.filter(p => (p.provider || 'animeav1') === this.selectedProvider);
      if (filtered.length) return filtered;
    }
    return list;
  }

  private get playablePlayers(): Player[] {
    return this.players.filter(player => {
      // El reproductor de Zilla rechaza los iframes y sus segmentos responden 403.
      if (/^player\.zilla-networks\.com$/i.test(new URL(player.url).hostname)) return false;
      // Algunos MP4Upload usan AV1; Safari en iPhone muestra un error de formato.
      if (this.isIphone && /(^|\.)mp4upload\.com$/i.test(new URL(player.url).hostname)) return false;
      return true;
    });
  }

  get hasExcludedPlayers(): boolean {
    return this.players.length > this.playablePlayers.length;
  }

  hasMultipleProviders(): boolean {
    const hasAv1 = this.playablePlayers.some(p => (p.provider || 'animeav1') === 'animeav1');
    const hasJk = this.playablePlayers.some(p => p.provider === 'jkanime');
    return hasAv1 && hasJk;
  }

  hasProviderPlayers(provider: string): boolean {
    return this.playablePlayers.some(p => (p.provider || 'animeav1') === provider);
  }

  setProvider(provider: 'all' | 'animeav1' | 'jkanime') {
    if (this.selectedProvider === provider) return;
    this.selectedProvider = provider;
    this.autoSelectBestPlayerForCurrentAudio();
  }

  hasDubPlayers(): boolean {
    return this.playablePlayers.some(p => p.audio === 'dub');
  }

  setAudioTrack(audio: 'sub' | 'dub') {
    if (this.selectedAudio === audio) return;
    this.selectedAudio = audio;
    this.autoSelectBestPlayerForCurrentAudio();
  }

  private autoSelectBestPlayerForCurrentAudio() {
    const available = this.displayedPlayers;
    if (!available.length) return;

    // Preferencia inteligente de reproductores (optimizada para iOS/iPhone y compatibilidad):
    // 1. UPNShare (excelente soporte nativo en iOS con su propio botón fullscreen integrado)
    // 2. Primer reproductor disponible del audio elegido
    const upnSharePlayer = available.find(p => /upnshare/i.test(p.name) || /uns\.bio/i.test(p.url));
    const defaultChoice = upnSharePlayer || available[0];
    this.selectPlayer(defaultChoice);
  }

  selectPlayer(player: Player) {
    const url = new URL(player.url);
    this.failedPlayerUrls.delete(player.url);
    if (player.type === 'direct') {
      if (url.protocol !== 'https:' || !/(^|\.)mp4upload\.com$/i.test(url.hostname) || url.username || url.password) return;
      this.selectedPlayer = player.url;
      this.streamingError = '';
      this.safeIframeUrl = null;
      this.directVideoUrl = player.url;
      return;
    }
    const hosts = ['player.zilla-networks.com', 'animeav1.uns.bio', 'voe.sx', 'mega.nz', 'www.mp4upload.com', 'mp4upload.com', 'byselapuix.com', 'jkanime.net', 'streamtape.com'];
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) return;
    this.selectedPlayer = player.url;
    this.streamingError = '';
    this.directVideoUrl = '';
    this.safeIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(player.url);
  }

  onIframeLoad() { /* Cross-origin frame */ }
  onIframeError(event: Event) {
    if (!this.tryNextPlayer()) {
      this.streamingError = 'Este servidor no pudo abrirse. No quedan otros reproductores compatibles; puedes reintentar o abrir el origen.';
    }
  }

  onNativeVideoError() {
    if (!this.tryNextPlayer()) this.streamingError = 'El video no pudo cargarse. Prueba reintentar o abrir el capítulo en origen.';
  }

  canTryNextPlayer(): boolean {
    return this.playablePlayers.some(player => player.url !== this.selectedPlayer && !this.failedPlayerUrls.has(player.url));
  }

  tryNextPlayer(): boolean {
    if (this.selectedPlayer) this.failedPlayerUrls.add(this.selectedPlayer);
    const candidates = [...this.displayedPlayers, ...this.playablePlayers];
    const next = candidates.find(player => player.url !== this.selectedPlayer && !this.failedPlayerUrls.has(player.url));
    if (!next) return false;
    this.selectedProvider = 'all';
    this.selectPlayer(next);
    return true;
  }

  searchExternalWeb() {
    const term = `ver ${this.animeTitle || ''} episodio ${this.episodeNumber} online sub espanol`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(term)}`, '_blank');
  }

  hasEnglishTitle() { return !!this.anime?.title_english && this.anime.title_english !== this.animeTitle; }
  tryEnglishTitle() { void this.loadEpisode(true); }
  reloadCurrentEpisode() { void this.loadEpisode(); }
  hasPreviousEpisode() { return this.episodeNumber > 1; }
  hasNextEpisode() {
    const limit = this.maxAiredEpisode > 0 ? this.maxAiredEpisode : this.totalEpisodes;
    return this.episodeNumber < limit;
  }
  goToPreviousEpisode() { if (this.hasPreviousEpisode()) this.selectEpisode(this.episodeNumber - 1); }
  goToNextEpisode() { if (this.hasNextEpisode()) this.selectEpisode(this.episodeNumber + 1); }
  goToLatestAvailableEpisode() { if (this.maxAiredEpisode > 0) this.selectEpisode(this.maxAiredEpisode); }
  isEpisodeUnreleased(number: number): boolean { return this.maxAiredEpisode > 0 && number > this.maxAiredEpisode; }
  selectEpisode(number: number) {
    if (this.isEpisodeUnreleased(number)) {
      this.isNotReleased = true;
      this.streamingError = `El episodio ${number} aún no ha salido.`;
      return;
    }
    this.safeIframeUrl = null;
    const querySlug = this.route.snapshot.queryParams['slug'];
    this.router.navigate(['/watch', this.animeId, number], {
      queryParams: querySlug ? { slug: querySlug } : {},
      replaceUrl: true,
      state: { backTarget: history.state?.backTarget }
    });
  }
  getEpisodeThumbnail(episode: any) { return episode.thumbnail || this.episodeThumbnail; }
  openExternalLink(url: string) { if (url.startsWith('https://animeav1.com/') || url.startsWith('https://jkanime.net/')) window.open(url, '_blank', 'noopener,noreferrer'); }
  goBack() {
    this.safeIframeUrl = null;
    const backTarget = history.state?.backTarget;
    if (typeof backTarget === 'string' && backTarget.startsWith('/') && history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/anime', this.animeId], { replaceUrl: true });
    }
  }

  ionViewWillLeave() {
    ++this.generation;
    this.safeIframeUrl = null;
    this.closeExpanded();
    if (document.fullscreenElement === this.playerSurface?.nativeElement) void document.exitFullscreen();
  }

  ngOnDestroy() {
    ++this.generation;
    this.safeIframeUrl = null;
    this.subscription.unsubscribe();
    if (this.progressSub) this.progressSub.unsubscribe();
  }
}
