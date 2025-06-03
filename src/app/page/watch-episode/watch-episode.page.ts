import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AnimeService } from '../../../managers/AnimeService';
import { Platform, ToastController } from '@ionic/angular';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { Location } from '@angular/common';

interface Episode {
  number: number;
  title?: string;
  duration?: string;
  thumbnail?: string;
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
  
  // URLs para integración real
  safeIframeUrl: SafeResourceUrl | null = null;
  streamingError: string = '';
  
  // Lista de episodios
  episodes: Episode[] = [];
  totalEpisodes: number = 0;
  
  // Nueva propiedad para el anime
  anime: any = null;
  iframeUrl: string | null = null;

  private fallbackTried = false;
  private iframeLoadTimeout: any;
  private routeSubscription: Subscription = new Subscription();
  private isInitialLoad = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private animeService: AnimeService,
    private platform: Platform,
    private sanitizer: DomSanitizer,
    private toastCtrl: ToastController,
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private location: Location
  ) { }

  ngOnInit() {
    // Suscribirse a cambios de parámetros para manejar navegación
    this.routeSubscription = this.route.params.subscribe(params => {
      const newAnimeId = params['animeId'] || '';
      const newEpisodeNumber = Number(params['episodeNumber']) || 1;
      
      // Si es la primera carga o cambió el anime, cargar todo
      if (this.isInitialLoad || newAnimeId !== this.animeId) {
        this.animeId = newAnimeId;
        this.episodeNumber = newEpisodeNumber;
        this.isInitialLoad = false;
        this.loadEpisode();
      }
      // Si solo cambió el episodio, solo recargar el iframe
      else if (newEpisodeNumber !== this.episodeNumber) {
        this.episodeNumber = newEpisodeNumber;
        this.loadEpisodeOnly();
      }
    });
  }

  async loadEpisode() {
    // Limpiar completamente el iframe anterior
    await this.clearIframeCompletely();
    
    if (this.animeId) {
      // Solo cargar datos del anime si no los tenemos ya
      if (!this.anime || this.anime.mal_id !== Number(this.animeId)) {
        await this.loadAnimeData();
      }
      this.loadEpisodeData();
    }
    
    // Cargar nuevo episodio con un pequeño delay para asegurar que el iframe anterior se limpió
    setTimeout(() => {
      this.iframeUrl = this.getAnimeAv1Url();
      this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
      this.setIframeLoadTimeout();
    }, 100);
  }

  // Nuevo método para cargar solo el episodio sin recargar datos del anime
  async loadEpisodeOnly() {
    // Limpiar solo el iframe
    await this.clearIframeCompletely();
    
    // Actualizar datos del episodio
    this.loadEpisodeData();
    
    // Cargar nuevo episodio
    setTimeout(() => {
      this.iframeUrl = this.getAnimeAv1Url();
      this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
      this.setIframeLoadTimeout();
    }, 100);
  }

  async clearIframeCompletely() {
    // Limpiar el iframe actual
    this.safeIframeUrl = null;
    this.iframeUrl = null;
    this.streamingError = '';
    this.fallbackTried = false;
    
    // Limpiar timeout si existe
    if (this.iframeLoadTimeout) {
      clearTimeout(this.iframeLoadTimeout);
      this.iframeLoadTimeout = null;
    }
    
    // Destruir físicamente cualquier iframe existente
    this.destroyExistingIframes();
    
    // Forzar actualización del DOM con más tiempo
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private destroyExistingIframes() {
    try {
      // Buscar todos los iframes en el componente
      const iframes = this.elementRef.nativeElement.querySelectorAll('iframe');
      iframes.forEach((iframe: HTMLIFrameElement) => {
        // Detener cualquier reproducción
        iframe.src = 'about:blank';
        // Remover del DOM
        this.renderer.removeChild(iframe.parentNode, iframe);
      });
      
      // También buscar por clase específica
      const videoIframes = this.elementRef.nativeElement.querySelectorAll('.video-iframe');
      videoIframes.forEach((iframe: HTMLIFrameElement) => {
        iframe.src = 'about:blank';
        this.renderer.removeChild(iframe.parentNode, iframe);
      });
      
      // Limpiar contenedores de iframe
      const iframeContainers = this.elementRef.nativeElement.querySelectorAll('.iframe-container');
      iframeContainers.forEach((container: HTMLElement) => {
        container.innerHTML = '';
      });
    } catch (error) {
      console.log('Error al limpiar iframes:', error);
    }
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
        this.showToast('Intentando cargar con el nombre en inglés...');
        this.setIframeLoadTimeout();
      } else if (!this.fallbackTried) {
        this.streamingError = 'No se pudo cargar el episodio. Intenta más tarde o revisa si el nombre en inglés es correcto.';
      }
    }, 5000);
  }

  async loadAnimeData() {
    return new Promise<void>((resolve) => {
      this.animeService.getAnimeById(Number(this.animeId)).subscribe({
        next: (response: any) => {
          const anime = response.data || response;
          this.anime = anime;
          this.animeTitle = anime.title || 'Anime';
          this.totalEpisodes = anime.episodes || 12;
          
          this.generateEpisodesList();
          this.episodeThumbnail = anime.images?.jpg?.large_image_url || 'assets/default-episode.png';
          resolve();
        },
        error: (err) => {
          console.error('Error al cargar anime:', err);
          this.animeTitle = 'Anime no encontrado';
          resolve();
        }
      });
    });
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

  // Navegación entre episodios optimizada
  hasPreviousEpisode(): boolean {
    return this.episodeNumber > 1;
  }

  hasNextEpisode(): boolean {
    return this.episodeNumber < this.totalEpisodes;
  }

  goToPreviousEpisode() {
    if (this.hasPreviousEpisode()) {
      // Usar navegación SPA en lugar de recarga completa
      this.router.navigate(['/watch', this.animeId, this.episodeNumber - 1], { replaceUrl: true });
    }
  }

  goToNextEpisode() {
    if (this.hasNextEpisode()) {
      // Usar navegación SPA en lugar de recarga completa
      this.router.navigate(['/watch', this.animeId, this.episodeNumber + 1], { replaceUrl: true });
    }
  }

  selectEpisode(episodeNumber: number) {
    if (episodeNumber !== this.episodeNumber) {
      // Usar navegación SPA en lugar de recarga completa
      this.router.navigate(['/watch', this.animeId, episodeNumber], { replaceUrl: true });
    }
  }

  getEpisodeThumbnail(episode: Episode): string {
    return episode.thumbnail || this.episodeThumbnail || 'assets/default-episode.png';
  }

  public getSafeIframeUrl(url: string | null): SafeResourceUrl | null {
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  }

  // Nuevo método para generar slug compatible con AnimeAV1
  generateAnimeSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  openExternalLink(url: string) {
    if (this.platform.is('capacitor')) {
      window.open(url, '_system');
    } else {
      window.open(url, '_blank');
    }
  }

  async goBack() {
    await this.clearIframeCompletely();
    this.router.navigate(['/tab/home']);
  }

  getAnimeAv1Url(): string {
    const slug = this.generateAnimeSlug(this.animeTitle);
    return `https://animeav1.com/media/${slug}/${this.episodeNumber}`;
  }

  onIframeLoad() {
    if (this.iframeLoadTimeout) {
      clearTimeout(this.iframeLoadTimeout);
    }
  }

  onIframeError(event: Event) {
    if (this.anime && this.anime.title_english && this.anime.title_english !== this.animeTitle) {
      const slug = this.generateAnimeSlug(this.anime.title_english);
      this.iframeUrl = `https://animeav1.com/media/${slug}/${this.episodeNumber}`;
      this.animeTitle = this.anime.title_english;
      setTimeout(() => {
        this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
      }, 100);
    } else {
      this.streamingError = 'No se pudo cargar el episodio. Intenta más tarde o revisa si el nombre en inglés es correcto.';
    }
  }

  // Método para verificar si el anime tiene título en inglés
  hasEnglishTitle(): boolean {
    return !!(this.anime && this.anime.title_english && this.anime.title_english.trim() !== '');
  }

  // Método mejorado para recargar solo el iframe con el nombre en inglés
  async tryEnglishTitle() {
    if (this.anime && this.anime.title_english) {
      // Limpiar iframe actual
      await this.clearIframeCompletely();
      
      const slug = this.generateAnimeSlug(this.anime.title_english);
      this.iframeUrl = `https://animeav1.com/media/${slug}/${this.episodeNumber}`;
      this.animeTitle = this.anime.title_english;
      
      // Mostrar mensaje de carga
      this.showToast('Cargando con nombre en inglés...');
      
      // Cargar con el nuevo título
      setTimeout(() => {
        this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
        this.setIframeLoadTimeout();
      }, 100);
    }
  }

  // Método para recargar el iframe actual (útil si hay problemas de carga)
  async reloadCurrentEpisode() {
    await this.clearIframeCompletely();
    
    setTimeout(() => {
      this.iframeUrl = this.getAnimeAv1Url();
      this.safeIframeUrl = this.getSafeIframeUrl(this.iframeUrl);
      this.setIframeLoadTimeout();
    }, 100);
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'top'
    });
    await toast.present();
  }

  ngOnDestroy() {
    // Limpiar suscripciones
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    
    // Limpiar iframe al salir
    this.clearIframeCompletely();
    
    if (this.iframeLoadTimeout) {
      clearTimeout(this.iframeLoadTimeout);
    }
  }
}
