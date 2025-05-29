import { Component, OnInit, OnDestroy } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';
import { FavoritesService } from '../../../managers/FavoritesService';
import { TimezoneService } from '../../../managers/TimezoneService';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { ToastController, LoadingController, ActionSheetController, Platform } from '@ionic/angular';

@Component({
  selector: 'app-season',
  templateUrl: './season.page.html',
  styleUrls: ['./season.page.scss'],
})
export class SeasonPage implements OnInit, OnDestroy {
  animes: any[] = [];
  filteredAnimes: any[] = [];
  paginatedAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;
  selectedDay: string = 'all';
  favorites: Set<number> = new Set();
  private destroy$ = new Subject<void>();
  lastRefresh: Date | null = null;
  
  // Nuevas propiedades para funcionalidades mejoradas
  selectedGenres: Set<string> = new Set();
  popularGenres: string[] = ['Action', 'Comedy', 'Drama', 'Romance', 'Fantasy', 'Slice of Life'];
  sortBy: string = 'popularity';
  currentPage: number = 1;
  itemsPerPage: number = 20;
  isLoadingMore: boolean = false;
  showScrollTop: boolean = false;
  activeFiltersCount: number = 0;
  currentSeason: string = '';
  currentYear: number = new Date().getFullYear();

  constructor(
    private animeService: AnimeService,
    private favoritesService: FavoritesService,
    private timezoneService: TimezoneService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController,
    private platform: Platform
  ) { }

  ngOnInit() {
    this.loadAnimes();
    this.loadFavorites();
    this.subscribeToAnimeUpdates();
    this.setCurrentSeason();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setCurrentSeason() {
    const month = new Date().getMonth();
    const seasons = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 
                    'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
    this.currentSeason = seasons[month];
  }

  private subscribeToAnimeUpdates() {
    // Suscribirse a actualizaciones automáticas del servicio
    this.animeService.seasonalAnime$
      .pipe(takeUntil(this.destroy$))
      .subscribe(animes => {
        if (animes.length > 0) {
          this.animes = animes;
          this.filterAnimesByDay();
          this.lastRefresh = new Date();
          console.log('Datos de temporada actualizados:', this.lastRefresh);
        }
      });
  }

  // Mapeo actualizado para días en español (zona horaria Chile)
  daysMap: { [key: string]: string } = {
    monday: 'lunes',
    tuesday: 'martes',
    wednesday: 'miércoles',
    thursday: 'jueves',
    friday: 'viernes',
    saturday: 'sábado',
    sunday: 'domingo'
  };

  // Mapeo inverso para filtros
  daysMapReverse: { [key: string]: string } = {
    'lunes': 'monday',
    'martes': 'tuesday',
    'miércoles': 'wednesday',
    'jueves': 'thursday',
    'viernes': 'friday',
    'sábado': 'saturday',
    'domingo': 'sunday'
  };

  async loadAnimes(showLoading: boolean = true) {
    if (showLoading) {
      this.isLoading = true;
    }
    
    this.error = null;
    
    this.animeService.getSeasonalAnime().subscribe({
      next: (response: any) => {
        this.animes = response.data;
        this.filteredAnimes = this.animes;
        this.isLoading = false;
        this.lastRefresh = new Date();
      },
      error: (err: any) => {
        this.error = err.message || 'Error al cargar los animes de temporada';
        this.isLoading = false;
        console.error('Error:', err);
        if (this.error) {
          this.showErrorToast(this.error);
        }
      }
    });
  }

  loadFavorites() {
    this.favoritesService.getFavorites().subscribe(favorites => {
      this.favorites.clear();
      favorites.forEach(anime => {
        const id = anime.mal_id || anime.id;
        if (id) this.favorites.add(id);
      });
    });
  }

  // NUEVA FUNCIONALIDAD: Compartir anime
  async shareAnime(anime: any) {
    const shareData = {
      title: `¡Mira este anime: ${anime.title}!`,
      text: `${anime.title} - ${anime.synopsis ? anime.synopsis.slice(0, 100) + '...' : 'Un anime increíble que deberías ver'}`,
      url: `https://myanimelist.net/anime/${anime.mal_id}`,
    };

    try {
      // Verificar si el dispositivo soporta Web Share API nativa
      if (this.platform.is('capacitor') && navigator.share) {
        await navigator.share(shareData);
        await this.showSuccessToast('¡Anime compartido exitosamente!');
      } else {
        // Fallback para web con action sheet
        await this.showShareActionSheet(anime);
      }
    } catch (error) {
      console.log('Error sharing:', error);
      // Fallback manual
      await this.showShareActionSheet(anime);
    }
  }

  async showShareActionSheet(anime: any) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: `Compartir: ${anime.title}`,
      buttons: [
        {
          text: 'Copiar enlace',
          icon: 'copy-outline',
          handler: () => {
            this.copyToClipboard(`https://myanimelist.net/anime/${anime.mal_id}`);
          }
        },
        {
          text: 'Compartir en redes sociales',
          icon: 'share-social-outline',
          handler: () => {
            this.shareToSocialMedia(anime);
          }
        },
        {
          text: 'Enviar por mensaje',
          icon: 'chatbubble-outline',
          handler: () => {
            this.shareViaMessage(anime);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      await this.showSuccessToast('Enlace copiado al portapapeles');
    } catch (error) {
      // Fallback para navegadores más antiguos
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      await this.showSuccessToast('Enlace copiado al portapapeles');
    }
  }

  shareToSocialMedia(anime: any) {
    const text = encodeURIComponent(`¡Mira este anime: ${anime.title}! ${anime.synopsis ? anime.synopsis.slice(0, 100) + '...' : ''}`);
    const url = encodeURIComponent(`https://myanimelist.net/anime/${anime.mal_id}`);
    
    // Abrir en una nueva ventana para compartir en Twitter
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  shareViaMessage(anime: any) {
    const text = `¡Mira este anime: ${anime.title}! ${anime.synopsis ? anime.synopsis.slice(0, 100) + '...' : ''} - https://myanimelist.net/anime/${anime.mal_id}`;
    
    if (this.platform.is('mobile')) {
      // Para móviles, intentar abrir la app de mensajes
      window.open(`sms:?body=${encodeURIComponent(text)}`);
    } else {
      // Para web, copiar al portapapeles
      this.copyToClipboard(text);
    }
  }

  // Método para verificar si es favorito
  isFavorite(anime: any): boolean {
    return this.favorites.has(anime.mal_id);
  }

  // MÉTODO ACTUALIZADO: Obtener conteo de animes por día usando zona horaria chilena
  getDayCount(day: string): number {
    if (day === 'all') {
      return this.animes.length;
    }

    const spanishDay = this.daysMap[day.toLowerCase()];
    
    return this.animes.filter(anime => {
      // Usar información de broadcast chileno si está disponible
      if (anime.broadcast_chile?.chile?.day) {
        return anime.broadcast_chile.chile.day.toLowerCase() === spanishDay;
      }
      
      // Fallback a broadcast original traducido
      if (anime.broadcast?.day) {
        const originalDay = this.timezoneService.translateDay(anime.broadcast.day);
        return originalDay.toLowerCase() === spanishDay;
      }
      
      return false;
    }).length;
  }

  // NUEVO MÉTODO: Obtener fecha de estreno en formato chileno
  getAiredDateChile(anime: any): string {
    if (anime.aired_chile?.formatted_chile) {
      return anime.aired_chile.formatted_chile;
    }
    
    if (anime.aired?.from) {
      const date = this.timezoneService.convertAiredDateToChile(anime.aired.from);
      return this.timezoneService.formatDateForChile(date);
    }
    
    return 'Fecha desconocida';
  }

  // NUEVO MÉTODO: Verificar si hay cambio de día por zona horaria
  hasDayChanged(anime: any): boolean {
    return anime.broadcast_chile?.chile?.day_changed || false;
  }

  // MÉTODO ACTUALIZADO: Obtener texto de estado con información de zona horaria
  getStatusTextWithTimezone(anime: any): string {
    const baseStatus = this.getStatusText(anime.status);
    
    if (anime.status?.toLowerCase() === 'currently airing' && this.hasDayChanged(anime)) {
      const broadcastInfo = this.getBroadcastInfo(anime);
      return `${baseStatus} • ${broadcastInfo.day}`;
    }
    
    return baseStatus;
  }

  // NUEVO MÉTODO: Obtener información completa de horarios para tooltips o detalles
  getFullTimezoneInfo(anime: any): string {
    if (!anime.broadcast_chile) return '';
    
    const broadcast = anime.broadcast_chile;
    let info = '';
    
    if (broadcast.chile) {
      info = `${broadcast.chile.day}`;
      if (broadcast.chile.time) {
        info += ` a las ${broadcast.chile.time}`;
      }
      info += ' (Chile)';
    }
    
    if (broadcast.chile?.day_changed && broadcast.original) {
      info += ` • Originalmente ${this.timezoneService.translateDay(broadcast.original.day)}`;
      if (broadcast.original.time) {
        info += ` a las ${broadcast.original.time}`;
      }
      info += ' (Japón)';
    }
    
    return info;
  }

  // NUEVO MÉTODO: Obtener días disponibles para filtros
  getAvailableDays(): Array<{key: string, name: string, count: number}> {
    const days = [
      { key: 'all', name: 'Todos', count: this.animes.length },
      { key: 'monday', name: 'Lunes', count: 0 },
      { key: 'tuesday', name: 'Martes', count: 0 },
      { key: 'wednesday', name: 'Miércoles', count: 0 },
      { key: 'thursday', name: 'Jueves', count: 0 },
      { key: 'friday', name: 'Viernes', count: 0 },
      { key: 'saturday', name: 'Sábado', count: 0 },
      { key: 'sunday', name: 'Domingo', count: 0 }
    ];

    // Calcular conteos para cada día
    days.forEach(day => {
      if (day.key !== 'all') {
        day.count = this.getDayCount(day.key);
      }
    });

    // Filtrar días que tengan al menos un anime
    return days.filter(day => day.key === 'all' || day.count > 0);
  }

  // NUEVO MÉTODO: Obtener información de broadcast para tarjetas
  getBroadcastInfo(anime: any): { day: string; time?: string; isChileTime?: boolean; dayChanged?: boolean } {
    // Priorizar información de Chile si está disponible
    if (anime.broadcast_chile?.chile) {
      return {
        day: anime.broadcast_chile.chile.day,
        time: anime.broadcast_chile.chile.time,
        isChileTime: true,
        dayChanged: anime.broadcast_chile.chile.day_changed
      };
    }
    
    // Fallback a información original traducida
    if (anime.broadcast?.day) {
      return {
        day: this.timezoneService.translateDay(anime.broadcast.day),
        time: anime.broadcast.time,
        isChileTime: false,
        dayChanged: false
      };
    }
    
    return { day: 'Desconocido', isChileTime: false };
  }

  clearAllFilters() {
    this.selectedDay = 'all';
    this.selectedGenres.clear();
    this.sortBy = 'popularity';
    this.applyFilters();
    this.updateActiveFiltersCount();
  }

  updateActiveFiltersCount() {
    this.activeFiltersCount = 0;
    if (this.selectedDay !== 'all') this.activeFiltersCount++;
    this.activeFiltersCount += this.selectedGenres.size;
  }

  scrollToTop() {
    document.querySelector('ion-content')?.scrollToTop(500);
  }

  openFilterModal() {
    // Implementar modal de filtros avanzados si es necesario
    console.log('Abrir modal de filtros');
  }

  filterAnimesByDay() {
    this.applyFilters();
    this.updateActiveFiltersCount();
  }

  async handleRefresh(event: any) {
    try {
      await this.loadAnimes(false);
      this.animeService.refreshAllData();
    } finally {
      event.target.complete();
    }
  }

  async forceRefresh() {
    const loading = await this.loadingCtrl.create({
      message: 'Actualizando datos...'
    });
    await loading.present();

    try {
      this.animeService.refreshAllData();
      await this.loadAnimes(false);
      await this.showSuccessToast('¡Datos actualizados exitosamente!');
    } catch (error) {
      await this.showErrorToast('Error al actualizar: ' + error);
    } finally {
      await loading.dismiss();
    }
  }

  // NUEVO: Método específico para corregir problemas de fechas
  async fixDateIssues() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: '¿Notaste fechas incorrectas?',
      subHeader: 'Esto forzará una actualización completa de todos los datos',
      buttons: [
        {
          text: 'Corregir fechas',
          icon: 'calendar-outline',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'Corrigiendo fechas y horarios...'
            });
            await loading.present();

            try {
              // Limpiar caché y forzar recarga
              this.animeService.clearCache();
              
              setTimeout(async () => {
                await this.loadAnimes();
                await loading.dismiss();
                await this.showSuccessToast('¡Datos actualizados!');
              }, 2000);
              
            } catch (error) {
              await loading.dismiss();
              await this.showErrorToast('Error al actualizar: ' + error);
            }
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async toggleFavorite(anime: any) {
    try {
      const result = await this.favoritesService.toggleFavorite(anime).pipe(take(1)).toPromise();
      
      if (!result) {
        throw new Error('No se pudo procesar la solicitud');
      }

      if (result.action === 'added') {
        this.favorites.add(anime.mal_id);
      } else {
        this.favorites.delete(anime.mal_id);
      }
      
      await this.toastCtrl.create({
        message: result.action === 'added' ? 'Añadido a favoritos' : 'Eliminado de favoritos',
        duration: 2000,
        color: result.action === 'added' ? 'success' : 'medium'
      }).then(toast => toast.present());

    } catch (error) {
      await this.toastCtrl.create({
        message: 'Por favor, inicia sesión para añadir favoritos',
        duration: 3000,
        color: 'danger'
      }).then(toast => toast.present());
    }
  }

  private async showErrorToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }

  private async showSuccessToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
  }

  getLastRefreshText(): string {
    if (!this.lastRefresh) return 'Nunca actualizado';
    
    const now = new Date();
    const diff = now.getTime() - this.lastRefresh.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Actualizado hace menos de 1 minuto';
    if (minutes === 1) return 'Actualizado hace 1 minuto';
    if (minutes < 60) return `Actualizado hace ${minutes} minutos`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Actualizado hace 1 hora';
    return `Actualizado hace ${hours} horas`;
  }

  // MÉTODO ACTUALIZADO: Obtener nombre del día en español
  getDayName(day: string): string {
    if (day === 'all') return 'Todos';
    
    const dayNames: { [key: string]: string } = {
      'monday': 'Lunes',
      'tuesday': 'Martes',
      'wednesday': 'Miércoles',
      'thursday': 'Jueves',
      'friday': 'Viernes',
      'saturday': 'Sábado',
      'sunday': 'Domingo'
    };
    return dayNames[day] || day;
  }

  // NUEVOS MÉTODOS para funcionalidades adicionales
  trackByAnimeId(index: number, anime: any): number {
    return anime.mal_id;
  }

  onImageError(event: any) {
    event.target.src = 'assets/images/placeholder-anime.jpg';
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'currently airing':
      case 'airing':
        return 'success';
      case 'finished airing':
      case 'completed':
        return 'primary';
      case 'not yet aired':
      case 'upcoming':
        return 'warning';
      default:
        return 'medium';
    }
  }

  getStatusText(status: string): string {
    switch (status?.toLowerCase()) {
      case 'currently airing':
        return 'En emisión';
      case 'finished airing':
        return 'Finalizado';
      case 'not yet aired':
        return 'Próximamente';
      default:
        return status || 'Desconocido';
    }
  }

  toggleGenreFilter(genre: string) {
    if (this.selectedGenres.has(genre)) {
      this.selectedGenres.delete(genre);
    } else {
      this.selectedGenres.add(genre);
    }
    this.applyFilters();
    this.updateActiveFiltersCount();
  }

  // MÉTODO ACTUALIZADO: Aplicar filtros considerando zona horaria chilena
  applyFilters() {
    let filtered = [...this.animes];
    
    // Filtro por día usando zona horaria chilena
    if (this.selectedDay !== 'all') {
      const selectedSpanishDay = this.daysMap[this.selectedDay.toLowerCase()];
      
      filtered = filtered.filter(anime => {
        // Usar información de broadcast chileno si está disponible
        if (anime.broadcast_chile?.chile?.day) {
          return anime.broadcast_chile.chile.day.toLowerCase() === selectedSpanishDay;
        }
        
        // Fallback a broadcast original traducido
        if (anime.broadcast?.day) {
          const originalDay = this.timezoneService.translateDay(anime.broadcast.day);
          return originalDay.toLowerCase() === selectedSpanishDay;
        }
        
        return false;
      });
    }
    
    // Filtro por géneros
    if (this.selectedGenres.size > 0) {
      filtered = filtered.filter(anime => {
        return anime.genres?.some((genre: any) => 
          this.selectedGenres.has(genre.name)
        );
      });
    }
    
    this.filteredAnimes = filtered;
    this.applySorting();
    this.resetPagination();
  }

  applySorting() {
    this.filteredAnimes.sort((a, b) => {
      switch (this.sortBy) {
        case 'score':
          return (b.score || 0) - (a.score || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        case 'members':
          return (b.members || 0) - (a.members || 0);
        case 'episodes':
          return (b.episodes || 0) - (a.episodes || 0);
        case 'popularity':
        default:
          return (a.popularity || 999999) - (b.popularity || 999999);
      }
    });
    this.updatePaginatedAnimes();
  }

  resetPagination() {
    this.currentPage = 1;
    this.updatePaginatedAnimes();
  }

  updatePaginatedAnimes() {
    const startIndex = 0;
    const endIndex = this.currentPage * this.itemsPerPage;
    this.paginatedAnimes = this.filteredAnimes.slice(startIndex, endIndex);
  }

  loadMoreAnimes() {
    if (this.isLoadingMore) return;
    
    this.isLoadingMore = true;
    this.currentPage++;
    
    setTimeout(() => {
      this.updatePaginatedAnimes();
      this.isLoadingMore = false;
    }, 500);
  }
}
