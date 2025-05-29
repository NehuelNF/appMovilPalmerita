import { Component } from '@angular/core';
import { NotificationService } from './managers/NotificationService';
import { FavoritesService } from '../managers/FavoritesService'; // Corrected path
import { AnimeService } from '../managers/AnimeService'; // Corrected path

// Minimal interface for Anime objects based on usage
interface Anime {
  mal_id: number;
  id: number;
  title: string;
  aired?: { from?: string };
  airing?: boolean; // Added
  broadcast?: { // Added
    day?: string;
    time?: string;
    timezone?: string;
  };
  broadcast_chile?: { // Added
    chile?: {
      day?: string;
      time?: string;
    };
    original?: {
      day?: string;
      time?: string;
    };
  };
  // Add other relevant properties from your Anime structure
  [key: string]: any;
}

// Minimal interface for the response from AnimeService methods
interface AnimeListResponse {
  data: Anime[];
  pagination?: any;
}

// Minimal interface for Favorite Anime objects
interface FavoriteAnime {
  id: number;
  mal_id: number;
  // Add other relevant properties from your FavoriteAnime structure
  [key: string]: any;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private notificationService: NotificationService,
    private favoritesService: FavoritesService,
    private animeService: AnimeService
  ) {
    this.initNotifications();
  }

  private getDayOfWeekFromString(dayName: string): number | null {
    if (!dayName) return null;
    const lowerDayName = dayName.toLowerCase().trim();
    switch (lowerDayName) {
      case 'domingo': return 0;
      case 'lunes': return 1;
      case 'martes': return 2;
      case 'miércoles':
      case 'miercoles': return 3;
      case 'jueves': return 4;
      case 'viernes': return 5;
      case 'sábado':
      case 'sabado': return 6;
      default:
        console.warn(`Nombre de día no reconocido: ${dayName}`);
        return null;
    }
  }

  private async initNotifications() {
    try {
      await this.notificationService.requestPermission();
    } catch (error) {
      console.error('No se pudieron configurar las notificaciones:', error);
      return; // Salir si no hay permisos
    }

    this.favoritesService.getFavorites().subscribe((favs: FavoriteAnime[]) => {
      if (!favs) return;
      const favIds = favs.map((a: FavoriteAnime) => a.mal_id || a.id);
      console.log('🎯 IDs de animes favoritos:', favIds);

      // Notificaciones para estrenos de animes (próximamente) - MEJORADAS
      this.animeService.getUpcomingAnime().subscribe((resp: AnimeListResponse) => {
        if (!resp || !resp.data) return;
        resp.data
          .filter((anime: Anime) => favIds.includes(anime.mal_id || anime.id))
          .forEach(async (anime: Anime) => {
            if (anime.aired?.from) {
              const at = new Date(anime.aired.from);
              // Solo programar si la fecha es futura
              if (at.getTime() > new Date().getTime()) {
                try {
                  // Usar el nuevo método con recordatorios y respaldos
                  await this.notificationService.scheduleNotificationWithReminders(
                    `Estreno de ${anime.title}`,
                    `Tu favorito ${anime.title} se estrena hoy.`,
                    at,
                    anime.mal_id || anime.id,
                    'premiere'
                  );
                  console.log(`Notificación de estreno programada para ${anime.title} el ${at}`);
                } catch (error) {
                  console.error(`Error programando notificación para ${anime.title}:`, error);
                }
              }
            }
          });
      });

      // Notificaciones para nuevos episodios de animes en emisión (temporada actual) - MEJORADAS
      this.animeService.getSeasonalAnime().subscribe((resp: AnimeListResponse) => {
        if (!resp || !resp.data) return;
        
        console.log('🔍 ANÁLISIS DETALLADO DE ANIMES EN EMISIÓN:');
        console.log('=====================================');
        
        // Crear una lista de todas las próximas fechas de emisión
        const nextEpisodeDates: { anime: Anime, date: Date, title: string }[] = [];
        
        resp.data
          .filter((anime: Anime) => favIds.includes(anime.mal_id || anime.id) && anime.airing)
          .forEach((anime: Anime) => {
            console.log(`\n📺 Anime: ${anime.title} (ID: ${anime.mal_id || anime.id})`);
            console.log(`   Favorito: ✅, En emisión: ${anime.airing ? '✅' : '❌'}`);
            
            if (anime.broadcast_chile?.chile?.day && anime.broadcast_chile?.chile?.time) {
              const chileDayStr = anime.broadcast_chile.chile.day;
              const chileTimeStr = anime.broadcast_chile.chile.time; // Formato "HH:mm"

              console.log(`   Broadcast Chile: ${chileDayStr} a las ${chileTimeStr}`);

              const targetDayOfWeek = this.getDayOfWeekFromString(chileDayStr);
              if (targetDayOfWeek === null) {
                console.log(`   ❌ Día inválido: ${chileDayStr}`);
                return; // Día no válido, no se puede programar
              }

              const timeParts = chileTimeStr.split(':');
              if (timeParts.length !== 2) {
                  console.warn(`Formato de hora no reconocido para ${anime.title}: ${chileTimeStr}`);
                  return; // Formato de hora no válido
              }
              const hours = parseInt(timeParts[0], 10);
              const minutes = parseInt(timeParts[1], 10);

              if (isNaN(hours) || isNaN(minutes)) {
                console.warn(`Hora inválida para ${anime.title}: ${chileTimeStr}`);
                return; // Hora no válida
              }

              // LÓGICA CORREGIDA: Calcular correctamente la próxima fecha de emisión
              const now = new Date();
              const currentDayOfWeek = now.getDay();
              
              console.log(`   Día objetivo: ${chileDayStr} (${targetDayOfWeek}), Día actual: ${currentDayOfWeek}`);
              
              // Calcular días hasta el próximo episodio
              let daysUntilBroadcast = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
              console.log(`   Días hasta broadcast (inicial): ${daysUntilBroadcast}`);
              
              // Si es el mismo día de la semana (daysUntilBroadcast === 0)
              if (daysUntilBroadcast === 0) {
                const nextBroadcastToday = new Date(now);
                nextBroadcastToday.setHours(hours, minutes, 0, 0);
                
                console.log(`   Es el mismo día. Hora hoy: ${nextBroadcastToday.toLocaleString('es-CL')}`);
                console.log(`   Hora actual: ${now.toLocaleString('es-CL')}`);
                
                // Si la hora de hoy ya pasó, programar para la próxima semana
                if (nextBroadcastToday.getTime() <= now.getTime()) {
                  daysUntilBroadcast = 7;
                  console.log(`   ⏰ Hora ya pasó, programando para próxima semana (7 días)`);
                } else {
                  // Si la hora de hoy no ha pasado, mantener para hoy (0 días)
                  daysUntilBroadcast = 0;
                  console.log(`   ⏰ Hora no ha pasado, programando para hoy (0 días)`);
                }
              }
              
              const nextBroadcastDate = new Date(now);
              nextBroadcastDate.setDate(now.getDate() + daysUntilBroadcast);
              nextBroadcastDate.setHours(hours, minutes, 0, 0);

              console.log(`   ✅ Fecha final calculada: ${nextBroadcastDate.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`);

              // Agregar a la lista de próximas fechas
              nextEpisodeDates.push({
                anime,
                date: nextBroadcastDate,
                title: anime.title
              });

            } else {
              console.log(`   ❌ Sin datos de broadcast en Chile`);
              if (anime.broadcast) {
                console.log(`   Broadcast original:`, anime.broadcast);
              }
              if (anime.broadcast_chile) {
                console.log(`   Broadcast Chile disponible:`, anime.broadcast_chile);
              }
            }
          });

        console.log('\n🗓️ RESUMEN DE PRÓXIMAS FECHAS:');
        console.log('==============================');
        nextEpisodeDates
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .forEach((episode, index) => {
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const dayName = dayNames[episode.date.getDay()];
            console.log(`${index + 1}. ${episode.title} - ${dayName} ${episode.date.toLocaleString('es-CL')}`);
          });

        // Programar notificaciones solo para fechas futuras
        const futureEpisodes = nextEpisodeDates.filter(episode => episode.date.getTime() > new Date().getTime());
        
        // Programar todas las notificaciones primero (secuencialmente para evitar conflictos)
        (async () => {
          for (const episode of futureEpisodes) {
            try {
              // Obtener la hora de emisión de forma segura
              const broadcastTime = episode.anime.broadcast_chile?.chile?.time || 'la hora programada';
              
              // Usar el nuevo método confiable con múltiples respaldos
              await this.notificationService.scheduleReliableNotification(
                `Nuevo episodio de ${episode.anime.title}`,
                `¡Hoy se estrena un nuevo episodio de ${episode.anime.title} a las ${broadcastTime} (Chile)!`,
                episode.date,
                episode.anime.mal_id || episode.anime.id,
                'episode'
              );
              console.log(`✅ Notificación programada: ${episode.anime.title} el ${episode.date.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`);
            } catch (error) {
              console.error(`❌ Error programando notificación para ${episode.anime.title}:`, error);
            }
          }
          
          // NUEVO: Verificar estadísticas después de programar
          setTimeout(async () => {
            const stats = await this.notificationService.getNotificationStats();
            console.log('\n📊 ESTADÍSTICAS FINALES DESPUÉS DE PROGRAMAR:');
            console.log('==============================================');
            console.log(`Notificaciones programadas: ${stats.scheduled}`);
            console.log(`Notificaciones pendientes: ${stats.pending}`);
            if (stats.nextNotification) {
              const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
              const dayName = dayNames[stats.nextNotification.scheduledAt.getDay()];
              console.log(`Próxima notificación: ${stats.nextNotification.title}`);
              console.log(`Fecha: ${dayName} ${stats.nextNotification.scheduledAt.toLocaleString('es-CL')}`);
              console.log(`Tipo: ${stats.nextNotification.type}`);
              console.log(`ID del anime: ${stats.nextNotification.animeId}`);
            } else {
              console.log('❌ No se encontró próxima notificación');
            }
          }, 1000); // Esperar 1 segundo para que se procesen todas las notificaciones
        })();
      });
    });
  }
}
