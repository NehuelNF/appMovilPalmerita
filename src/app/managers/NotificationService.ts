import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  scheduledAt: Date;
  animeId: number;
  type: 'episode' | 'premiere';
  backupIds: number[];
  created: Date;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private storageKey = 'scheduled_notifications';
  private maxBackupNotifications = 3;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    // Verificar notificaciones perdidas al iniciar la app
    await this.checkMissedNotifications();
    // Limpiar notificaciones expiradas
    await this.cleanupExpiredNotifications();
  }

  async requestPermission(): Promise<void> {
    try {
      const result = await LocalNotifications.requestPermissions();
      if (result.display === 'granted') {
        console.log('Permiso de notificación concedido');
      } else {
        console.warn('Permiso de notificación no concedido');
        // Mostrar un mensaje al usuario explicando por qué necesitamos permisos
        throw new Error('Permisos de notificación requeridos para recibir alertas de animes');
      }
    } catch (error) {
      console.error('Error al solicitar permiso de notificación:', error);
      throw error;
    }
  }

  /**
   * Programa una notificación con múltiples respaldos para mayor confiabilidad
   */
  async scheduleReliableNotification(
    title: string,
    body: string,
    scheduledAt: Date,
    animeId: number,
    type: 'episode' | 'premiere' = 'episode'
  ): Promise<void> {
    try {
      const baseId = this.generateNotificationId(animeId, type);
      const backupIds: number[] = [];

      // Programar notificación principal
      await this.scheduleNotification(title, body, scheduledAt, baseId);

      // Programar notificaciones de respaldo (5 min, 15 min y 30 min después)
      const backupIntervals = [5, 15, 30]; // minutos
      
      for (let i = 0; i < this.maxBackupNotifications; i++) {
        const backupTime = new Date(scheduledAt.getTime() + backupIntervals[i] * 60 * 1000);
        const backupId = baseId + (i + 1) * 1000;
        backupIds.push(backupId);

        await this.scheduleNotification(
          `${title} (Recordatorio)`,
          `${body} - ¡No te lo pierdas!`,
          backupTime,
          backupId
        );
      }

      // Guardar información de la notificación para seguimiento
      await this.saveScheduledNotification({
        id: baseId,
        title,
        body,
        scheduledAt,
        animeId,
        type,
        backupIds,
        created: new Date()
      });

      console.log(`Notificación confiable programada para ${title} con ${backupIds.length} respaldos`);
    } catch (error) {
      console.error('Error al programar notificación confiable:', error);
      throw error;
    }
  }

  /**
   * Programa una notificación con recordatorios previos
   */
  async scheduleNotificationWithReminders(
    title: string,
    body: string,
    scheduledAt: Date,
    animeId: number,
    type: 'episode' | 'premiere' = 'episode'
  ): Promise<void> {
    const now = new Date();
    const timeUntilEvent = scheduledAt.getTime() - now.getTime();
    
    // Solo agregar recordatorios si faltan más de 2 horas
    if (timeUntilEvent > 2 * 60 * 60 * 1000) {
      // Recordatorio 1 hora antes
      const reminderTime = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
      await this.scheduleNotification(
        `📺 Próximo estreno`,
        `${title} se estrena en 1 hora`,
        reminderTime,
        this.generateNotificationId(animeId, 'reminder')
      );
    }

    // Notificación principal con respaldos
    await this.scheduleReliableNotification(title, body, scheduledAt, animeId, type);
  }

  /**
   * Schedule a local notification at a specific time (versión mejorada)
   */
  async scheduleNotification(
    title: string,
    body: string,
    at: Date = new Date(Date.now() + 1000),
    id?: number
  ): Promise<void> {
    try {
      const notificationId = id || new Date().getTime();
      
      // Verificar que la fecha sea futura
      if (at.getTime() <= Date.now()) {
        console.warn(`No se puede programar notificación en el pasado: ${at}`);
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: title,
            body: body,
            schedule: { at: at },
            sound: 'default', // Usar sonido por defecto del sistema
            attachments: undefined,
            actionTypeId: '',
            extra: {
              animeNotification: true,
              scheduledTime: at.toISOString()
            },
            smallIcon: 'notification_icon', // Icono personalizado si existe
            largeIcon: 'anime_icon', // Icono grande personalizado
          },
        ],
      });
      
      console.log(`Notificación programada: "${title}" a las ${at} (ID: ${notificationId})`);
    } catch (error) {
      console.error('Error al programar la notificación:', error);
      throw error;
    }
  }

  /**
   * Verifica notificaciones que podrían haberse perdido
   */
  private async checkMissedNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await this.getScheduledNotifications();
      const now = new Date();

      for (const notification of scheduledNotifications) {
        const timeSinceScheduled = now.getTime() - notification.scheduledAt.getTime();
        
        // Si pasaron menos de 30 minutos desde que debía enviarse
        if (timeSinceScheduled > 0 && timeSinceScheduled <= 30 * 60 * 1000) {
          await this.sendMissedNotification(notification);
        }
      }
    } catch (error) {
      console.error('Error verificando notificaciones perdidas:', error);
    }
  }

  /**
   * Envía una notificación perdida inmediatamente
   */
  private async sendMissedNotification(notification: ScheduledNotification): Promise<void> {
    const missedTitle = `📱 ${notification.title} (Perdido)`;
    const missedBody = `${notification.body} - ¡Acabas de perderte esto!`;
    
    await this.scheduleNotification(
      missedTitle,
      missedBody,
      new Date(Date.now() + 1000), // Enviar en 1 segundo
      notification.id + 9000 // ID único para notificación perdida
    );

    console.log(`Notificación perdida enviada: ${notification.title}`);
  }

  /**
   * Genera un ID único para las notificaciones
   */
  private generateNotificationId(animeId: number, type: string): number {
    const typePrefix = type === 'episode' ? 2000000 : 
                      type === 'premiere' ? 1000000 : 
                      type === 'reminder' ? 3000000 : 4000000;
    return animeId + typePrefix;
  }

  /**
   * Guarda información de notificaciones programadas
   */
  private async saveScheduledNotification(notification: ScheduledNotification): Promise<void> {
    try {
      const notifications = await this.getScheduledNotifications();
      
      // Remover notificación existente para el mismo anime si existe
      const filtered = notifications.filter(n => n.animeId !== notification.animeId || n.type !== notification.type);
      filtered.push(notification);
      
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error guardando notificación programada:', error);
    }
  }

  /**
   * Obtiene notificaciones programadas guardadas
   */
  private async getScheduledNotifications(): Promise<ScheduledNotification[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      
      const notifications = JSON.parse(stored);
      // Convertir strings de fecha de vuelta a objetos Date
      return notifications.map((n: any) => ({
        ...n,
        scheduledAt: new Date(n.scheduledAt),
        created: new Date(n.created)
      }));
    } catch (error) {
      console.error('Error obteniendo notificaciones programadas:', error);
      return [];
    }
  }

  /**
   * Limpia notificaciones expiradas (más de 7 días)
   */
  private async cleanupExpiredNotifications(): Promise<void> {
    try {
      const notifications = await this.getScheduledNotifications();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const activeNotifications = notifications.filter(n => n.scheduledAt > weekAgo);
      
      if (activeNotifications.length !== notifications.length) {
        localStorage.setItem(this.storageKey, JSON.stringify(activeNotifications));
        console.log(`Limpiadas ${notifications.length - activeNotifications.length} notificaciones expiradas`);
      }
    } catch (error) {
      console.error('Error limpiando notificaciones expiradas:', error);
    }
  }

  async getPending() {
    return LocalNotifications.getPending();
  }

  /**
   * Obtiene estadísticas de notificaciones
   */
  async getNotificationStats(): Promise<{
    pending: number;
    scheduled: number;
    nextNotification?: ScheduledNotification;
  }> {
    try {
      const [pending, scheduled] = await Promise.all([
        this.getPending(),
        this.getScheduledNotifications()
      ]);

      const now = new Date();
      const futureNotifications = scheduled.filter(n => n.scheduledAt > now);
      const nextNotification = futureNotifications.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

      return {
        pending: pending.notifications?.length || 0,
        scheduled: futureNotifications.length,
        nextNotification
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { pending: 0, scheduled: 0 };
    }
  }

  // Nuevo método para enviar una notificación de prueba
  async sendTestNotification(): Promise<void> {
    await this.requestPermission();
    const now = new Date();
    try {
      await this.scheduleNotification(
        '🔔 Notificación de Prueba',
        '¡Las notificaciones están funcionando correctamente!',
        new Date(now.getTime() + 1000),
        999999
      );
      console.log('Notificación de prueba enviada.');
    } catch (error) {
      console.error('Error al enviar la notificación de prueba:', error);
      throw error;
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
        console.log('Todas las notificaciones pendientes han sido canceladas.');
      }
      
      // Limpiar también el almacenamiento local
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error al cancelar notificaciones:', error);
    }
  }

  /**
   * Cancela notificaciones específicas de un anime
   */
  async cancelAnimeNotifications(animeId: number): Promise<void> {
    try {
      const notifications = await this.getScheduledNotifications();
      const animeNotifications = notifications.filter(n => n.animeId === animeId);
      
      for (const notification of animeNotifications) {
        // Cancelar notificación principal y respaldos
        const idsToCancel = [notification.id, ...notification.backupIds];
        
        for (const id of idsToCancel) {
          await LocalNotifications.cancel({ notifications: [{ id }] });
        }
      }
      
      // Actualizar almacenamiento
      const remaining = notifications.filter(n => n.animeId !== animeId);
      localStorage.setItem(this.storageKey, JSON.stringify(remaining));
      
      console.log(`Canceladas notificaciones para anime ${animeId}`);
    } catch (error) {
      console.error('Error cancelando notificaciones del anime:', error);
    }
  }
}
