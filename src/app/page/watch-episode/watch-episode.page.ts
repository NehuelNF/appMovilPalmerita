import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AnimeService } from '../../../managers/AnimeService';
import { StreamingService } from '../../../managers/StreamingService';
import { Platform, ToastController, LoadingController, ActionSheetController } from '@ionic/angular';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { Subscription, fromEvent } from 'rxjs';
import { HttpClient } from '@angular/common/http';

interface Episode {
  number: number;
  title?: string;
  duration?: string;
  thumbnail?: string;
}

interface StreamingLink {
  url: string;
  provider: string;
  quality?: string;
  type: 'iframe' | 'direct' | 'hls' | 'm3u8';
  isWorking: boolean;
}

export interface AnimeAV1Embed {
  server: string;
  url: string;
}

@Component({
  selector: 'app-watch-episode',
  templateUrl: './watch-episode.page.html',
  styleUrls: ['./watch-episode.page.scss'],
})
export class WatchEpisodePage implements OnInit, OnDestroy {
  animeId: string = '';
  episodeNumber: number = 1;
  animeTitle: string = '';
  episodeTitle: string = '';
  episodeThumbnail: string = '';
  
  // Nuevas propiedades para streaming
  streamingLinks: StreamingLink[] = [];
  currentStreamingLink: StreamingLink | null = null;
  safeIframeUrl: SafeResourceUrl | null = null;
  isLoadingStreams: boolean = false;
  streamingError: string = '';
  
  // URLs para integración real
  animeav1Url: string = '';
  isExternalPlayer: boolean = false;
  
  // Estados del reproductor
  videoLoaded: boolean = false;
  isPlaying: boolean = false;
  isFullscreen: boolean = false;
  showControls: boolean = true;
  isMuted: boolean = false;
  
  // Progreso del video
  progress: number = 0;
  currentTime: string = '00:00';
  duration: string = '24:00';
  
  // Lista de episodios
  episodes: Episode[] = [];
  totalEpisodes: number = 0;
  
  // New properties for enhanced video player
  @ViewChild('videoContainer', { static: false }) videoContainer!: ElementRef;
  private keyboardSubscription?: Subscription;
  private touchStartTime: number = 0;
  private lastTouchTime: number = 0;
  private pipSupported: boolean = false;
  private isPictureInPicture: boolean = false;
  
  // Volume and quality controls
  volume: number = 1;
  selectedQuality: string = 'auto';
  availableQualities: string[] = ['auto', '1080p', '720p', '480p', '360p'];
  
  // Playback speed
  playbackSpeed: number = 1;
  availableSpeeds: number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  
  // Auto-next episode
  autoNextEpisode: boolean = true;
  nextEpisodeCountdown: number = 0;
  private countdownInterval?: any;

  private controlsTimeout: any;

  // Nuevas propiedades para AnimeAV1
  animeAV1Embeds: AnimeAV1Embed[] = [];
  selectedServer: string = '';

  // Nueva propiedad para la barra de servidores scrapeada
  serverBarHtml: SafeHtml | null = null;
  iframeUrl: string | null = null;

  // Nueva propiedad para el anime
  anime: any = null;

  private fallbackTried = false;
  private iframeLoadTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private animeService: AnimeService,
    private streamingService: StreamingService,
    private platform: Platform,
    private sanitizer: DomSanitizer,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController,
    private http: HttpClient
  ) { }

  ngOnInit() {
    this.animeId = this.route.snapshot.paramMap.get('animeId') || '';
    this.episodeNumber = Number(this.route.snapshot.paramMap.get('episodeNumber')) || 1;
    if (this.animeId) {
      this.loadAnimeData();
      this.loadEpisodeData();
    }
    // Cargar directamente la URL de AnimeAV1 en el iframe
    this.iframeUrl = this.getAnimeAv1Url();
    this.setIframeLoadTimeout();
  }

  setIframeLoadTimeout() {
    this.fallbackTried = false;
    if (this.iframeLoadTimeout) {
      clearTimeout(this.iframeLoadTimeout);
    }
    this.iframeLoadTimeout = setTimeout(() => {
      if (!this.fallbackTried && this.anime && this.anime.title_english && this.anime.title_english !== this.animeTitle) {
        this.fallbackTried = true;
        const slug = this.generateAnimeSlug(this.anime.title_english);
        this.iframeUrl = `https://animeav1.com/media/${slug}/${this.episodeNumber}`;
        this.animeTitle = this.anime.title_english;
        this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
        // Si quieres, puedes mostrar un toast aquí
        this.showToast('Intentando cargar con el nombre en inglés...');
        // Reiniciar timeout por si tampoco carga
        this.setIframeLoadTimeout();
      } else if (!this.fallbackTried) {
        this.streamingError = 'No se pudo cargar el episodio. Intenta más tarde o revisa si el nombre en inglés es correcto.';
      }
    }, 5000); // 5 segundos
  }

  async loadAnimeData() {
    this.animeService.getAnimeById(Number(this.animeId)).subscribe({
      next: (response: any) => {
        const anime = response.data || response;
        this.anime = anime;
        this.animeTitle = anime.title || 'Anime';
        this.totalEpisodes = anime.episodes || 12;
        
        this.generateEpisodesList();
        
        // Simular carga del video
        setTimeout(() => {
          this.videoLoaded = true;
          this.episodeThumbnail = anime.images?.jpg?.large_image_url || 'assets/default-episode.png';
        }, 1500);
      },
      error: (err) => {
        console.error('Error al cargar anime:', err);
        this.animeTitle = 'Anime no encontrado';
      }
    });
  }

  async selectStreamingLink(link: StreamingLink) {
    this.currentStreamingLink = link;
    
    if (link.type === 'iframe') {
      // Sanitizar URL para iframe
      this.safeIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(link.url);
    } else {
      // Para enlaces directos, abrir en navegador externo
      this.openExternalLink(link.url);
    }

    // Mostrar toast informativo
    const toast = await this.toastCtrl.create({
      message: `Reproduciendo desde ${link.provider}`,
      duration: 2000,
      color: 'success',
      position: 'top'
    });
    await toast.present();
  }

  async showStreamingOptions() {
    if (this.streamingLinks.length === 0) {
      const toast = await this.toastCtrl.create({
        message: 'No hay enlaces alternativos disponibles',
        duration: 2000,
        color: 'warning'
      });
      await toast.present();
      return;
    }

    const buttons: Array<{ text: string; icon: string; handler?: () => void; role?: string }> = this.streamingLinks.map(link => ({
      text: `${link.provider} (${link.quality || 'HD'})`,
      icon: link.type === 'iframe' ? 'tv-outline' : 'open-outline',
      handler: () => {
        this.selectStreamingLink(link);
      }
    }));

    buttons.push({
      text: 'Cancelar',
      icon: 'close',
      role: 'cancel'
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Seleccionar servidor de streaming',
      buttons
    });

    await actionSheet.present();
  }

  openExternalLink(url: string) {
    if (this.platform.is('capacitor')) {
      // En dispositivos móviles, abrir en navegador externo
      window.open(url, '_system');
    } else {
      // En web, abrir en nueva pestaña
      window.open(url, '_blank');
    }
  }

  // Nuevo método para generar slug compatible con AnimeAV1
  generateAnimeSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, '-') // Reemplazar espacios con guiones
      .replace(/-+/g, '-') // Remover guiones múltiples
      .trim();
  }

  // Método para alternar entre reproductor iframe y externo
  togglePlayerMode() {
    this.isExternalPlayer = !this.isExternalPlayer;
    
    if (this.isExternalPlayer && this.currentStreamingLink) {
      this.openExternalLink(this.currentStreamingLink.url);
    }
  }

  async refreshStreamingLinks() {
    // Limpiar cache y recargar
    this.streamingService.clearCache();
    // await this.loadStreamingData();
  }

  loadEpisodeData() {
    this.episodeTitle = `Episodio ${this.episodeNumber}`;
  }

  generateEpisodesList() {
    this.episodes = [];
    for (let i = 1; i <= this.totalEpisodes; i++) {
      this.episodes.push({
        number: i,
        title: `Episodio ${i}`,
        duration: '24:00'
      });
    }
  }

  // Controles del reproductor
  togglePlayPause() {
    this.isPlaying = !this.isPlaying;
    this.showControlsTemporarily();
    
    // En una implementación real, aquí controlarías el video real
    if (this.isPlaying) {
      this.startProgressSimulation();
    }
  }

  togglePlay() {
    this.togglePlayPause();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.showControlsTemporarily();
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    
    if (this.isFullscreen) {
      // Ocultar controles de Ionic
      document.body.classList.add('fullscreen-video');
    } else {
      document.body.classList.remove('fullscreen-video');
    }
    
    this.showControlsTemporarily();
  }

  exitFullscreen() {
    if (this.isFullscreen) {
      this.isFullscreen = false;
      document.body.classList.remove('fullscreen-video');
      this.showControlsTemporarily();
    }
  }

  toggleControls() {
    this.showControls = !this.showControls;
  }

  showControlsTemporarily() {
    this.showControls = true;
    
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }
    
    this.controlsTimeout = setTimeout(() => {
      if (this.isPlaying) {
        this.showControls = false;
      }
    }, 3000);
  }

  startProgressSimulation() {
    // Simulación del progreso del video
    const interval = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(interval);
        return;
      }
      
      this.progress += 0.5;
      if (this.progress >= 100) {
        this.progress = 100;
        this.isPlaying = false;
        clearInterval(interval);
      }
      
      // Actualizar tiempo actual
      const totalSeconds = Math.floor((this.progress / 100) * (24 * 60)); // 24 minutos
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      this.currentTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  // Navegación entre episodios
  hasPreviousEpisode(): boolean {
    return this.episodeNumber > 1;
  }

  hasNextEpisode(): boolean {
    return this.episodeNumber < this.totalEpisodes;
  }

  goToPreviousEpisode() {
    if (this.hasPreviousEpisode()) {
      this.router.navigate(['/watch', this.animeId, this.episodeNumber - 1]);
    }
  }

  goToNextEpisode() {
    if (this.hasNextEpisode()) {
      this.router.navigate(['/watch', this.animeId, this.episodeNumber + 1]);
    }
  }

  selectEpisode(episodeNumber: number) {
    if (episodeNumber !== this.episodeNumber) {
      this.router.navigate(['/watch', this.animeId, episodeNumber]);
    }
  }

  getEpisodeThumbnail(episode: Episode): string {
    return episode.thumbnail || this.episodeThumbnail || 'assets/default-episode.png';
  }

  // Métodos de utilidad
  getCurrentProviderName(): string {
    return this.currentStreamingLink?.provider || 'Desconocido';
  }

  hasMultipleStreams(): boolean {
    return this.streamingLinks.length > 1;
  }

  isIframeMode(): boolean {
    return this.currentStreamingLink?.type === 'iframe' && !this.isExternalPlayer;
  }

  public getSafeIframeUrl(url: string | null): SafeResourceUrl | null {
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  }

  ngOnDestroy() {
    // Limpiar cuando se destruye el componente
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }
    
    document.body.classList.remove('fullscreen-video');
    
    if (this.keyboardSubscription) {
      this.keyboardSubscription.unsubscribe();
    }
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    if (this.iframeLoadTimeout) {
      clearTimeout(this.iframeLoadTimeout);
    }
  }

  private setupKeyboardShortcuts() {
    this.keyboardSubscription = fromEvent<KeyboardEvent>(document, 'keydown').subscribe(event => {
      if (!this.currentStreamingLink || this.isExternalPlayer) return;
      
      switch (event.code) {
        case 'Space':
          event.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.skipTime(-10);
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.skipTime(10);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.adjustVolume(0.1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.adjustVolume(-0.1);
          break;
        case 'KeyM':
          event.preventDefault();
          this.toggleMute();
          break;
        case 'KeyF':
          event.preventDefault();
          this.toggleFullscreen();
          break;
        case 'KeyP':
          if (this.pipSupported) {
            event.preventDefault();
            this.togglePictureInPicture();
          }
          break;
        case 'Escape':
          if (this.isFullscreen) {
            this.exitFullscreen();
          }
          break;
      }
    });
  }

  private loadUserPreferences() {
    const preferences = localStorage.getItem('videoPlayerPreferences');
    if (preferences) {
      const prefs = JSON.parse(preferences);
      this.volume = prefs.volume || 1;
      this.playbackSpeed = prefs.playbackSpeed || 1;
      this.autoNextEpisode = prefs.autoNextEpisode !== undefined ? prefs.autoNextEpisode : true;
      this.selectedQuality = prefs.quality || 'auto';
    }
  }

  private saveUserPreferences() {
    const preferences = {
      volume: this.volume,
      playbackSpeed: this.playbackSpeed,
      autoNextEpisode: this.autoNextEpisode,
      quality: this.selectedQuality
    };
    localStorage.setItem('videoPlayerPreferences', JSON.stringify(preferences));
  }

  adjustVolume(delta: number) {
    this.volume = Math.max(0, Math.min(1, this.volume + delta));
    this.saveUserPreferences();
    this.showToast(`Volume: ${Math.round(this.volume * 100)}%`);
  }

  changePlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
    this.saveUserPreferences();
    this.showToast(`Speed: ${speed}x`);
  }

  changeQuality(quality: string) {
    this.selectedQuality = quality;
    this.saveUserPreferences();
    this.showToast(`Quality: ${quality}`);
    
    // Reload stream with new quality if supported
    if (this.currentStreamingLink) {
      // this.loadStreamingData();
    }
  }

  skipTime(seconds: number) {
    // This would work with a proper video element
    // For iframe players, we'll show a visual indicator
    this.showToast(`${seconds > 0 ? 'Forward' : 'Backward'} ${Math.abs(seconds)}s`);
  }

  async togglePictureInPicture() {
    if (!this.pipSupported) return;
    
    try {
      if (this.isPictureInPicture) {
        await document.exitPictureInPicture();
        this.isPictureInPicture = false;
      } else {
        // For iframe players, PiP support depends on the embedded player
        this.showToast('Picture-in-Picture requested');
        this.isPictureInPicture = true;
      }
    } catch (error) {
      console.error('PiP error:', error);
      this.showToast('Picture-in-Picture not available');
    }
  }

  onVideoEnded() {
    if (this.autoNextEpisode && this.hasNextEpisode()) {
      this.startNextEpisodeCountdown();
    }
  }

  private startNextEpisodeCountdown() {
    this.nextEpisodeCountdown = 10;
    this.countdownInterval = setInterval(() => {
      this.nextEpisodeCountdown--;
      if (this.nextEpisodeCountdown <= 0) {
        clearInterval(this.countdownInterval);
        this.goToNextEpisode();
      }
    }, 1000);
  }

  cancelNextEpisode() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.nextEpisodeCountdown = 0;
    }
  }

  // Enhanced touch controls for mobile
  onVideoTouch(event: TouchEvent) {
    const now = Date.now();
    
    if (event.type === 'touchstart') {
      this.touchStartTime = now;
    } else if (event.type === 'touchend') {
      const touchDuration = now - this.touchStartTime;
      const timeSinceLastTouch = now - this.lastTouchTime;
      
      // Double tap to seek
      if (timeSinceLastTouch < 300 && touchDuration < 200) {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        const x = event.changedTouches[0].clientX - rect.left;
        const width = rect.width;
        
        if (x < width / 3) {
          this.skipTime(-10);
        } else if (x > (width * 2) / 3) {
          this.skipTime(10);
        } else {
          this.togglePlay();
        }
      } else if (touchDuration < 200) {
        // Single tap to show/hide controls
        this.toggleControls();
      }
      
      this.lastTouchTime = now;
    }
  }

  private showToast(message: string) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 2000);
  }

  getAnimeAv1Url(): string {
    // Construye la URL del episodio en AnimeAV1
    // Ejemplo: https://animeav1.com/media/to-be-hero-x/1
    const slug = this.generateAnimeSlug(this.animeTitle);
    return `https://animeav1.com/media/${slug}/${this.episodeNumber}`;
  }

  // Nuevo: Manejo de error 404 en el iframe de AnimeAV1
  onIframeError(event: Event) {
    // Solo intentar una vez con el nombre en inglés
    if (this.anime && this.anime.title_english && this.anime.title_english !== this.animeTitle) {
      const slug = this.generateAnimeSlug(this.anime.title_english);
      this.iframeUrl = `https://animeav1.com/media/${slug}/${this.episodeNumber}`;
      this.animeTitle = this.anime.title_english;
      // Forzar recarga del iframe
      setTimeout(() => {
        this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
      }, 100);
    } else {
      this.streamingError = 'No se pudo cargar el episodio. Intenta más tarde o revisa si el nombre en inglés es correcto.';
    }
  }

  tryEnglishTitle() {
    if (this.anime && this.anime.title_english) {
      const slug = this.generateAnimeSlug(this.anime.title_english);
      this.iframeUrl = `https://animeav1.com/media/${slug}/${this.episodeNumber}`;
      this.animeTitle = this.anime.title_english;
      this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
    }
  }
}
