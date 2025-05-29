import { Component, OnInit } from '@angular/core';
import { NotificationService, ScheduledNotification } from '../../managers/NotificationService';
import { ToastController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-notifications-settings',
  templateUrl: './notifications-settings.page.html',
  styleUrls: ['./notifications-settings.page.scss'],
})
export class NotificationsSettingsPage implements OnInit {
  stats: {
    pending: number;
    scheduled: number;
    nextNotification?: ScheduledNotification;
  } = { pending: 0, scheduled: 0 };

  scheduledNotifications: ScheduledNotification[] = [];
  isLoading = false;

  constructor(
    private notificationService: NotificationService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    await this.loadNotificationData();
  }

  async ionViewWillEnter() {
    await this.loadNotificationData();
  }

  private async loadNotificationData() {
    this.isLoading = true;
    try {
      this.stats = await this.notificationService.getNotificationStats();
      console.log('Estadísticas de notificaciones:', this.stats);
      
      // NUEVO: Agregar logs detallados para debugging
      if (this.stats.nextNotification) {
        console.log('Próxima notificación encontrada:', {
          title: this.stats.nextNotification.title,
          scheduledAt: this.stats.nextNotification.scheduledAt,
          type: this.stats.nextNotification.type,
          animeId: this.stats.nextNotification.animeId,
          created: this.stats.nextNotification.created
        });
        
        const now = new Date();
        const dayOfWeek = this.stats.nextNotification.scheduledAt.getDay();
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        console.log(`La próxima notificación es para ${dayNames[dayOfWeek]} (día ${dayOfWeek})`);
        console.log(`Fecha actual: ${now.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`);
        console.log(`Fecha programada: ${this.stats.nextNotification.scheduledAt.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`);
      }
      
    } catch (error) {
      console.error('Error cargando datos de notificaciones:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async testNotifications() {
    try {
      await this.notificationService.sendTestNotification();
      const toast = await this.toastCtrl.create({
        message: '🔔 Notificación de prueba enviada',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'Error al enviar notificación de prueba',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  async clearAllNotifications() {
    const alert = await this.alertCtrl.create({
      header: 'Cancelar todas las notificaciones',
      message: '¿Estás seguro de que quieres cancelar todas las notificaciones programadas?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              await this.notificationService.cancelAllNotifications();
              await this.loadNotificationData();
              
              const toast = await this.toastCtrl.create({
                message: 'Todas las notificaciones han sido canceladas',
                duration: 2000,
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: 'Error al cancelar notificaciones',
                duration: 3000,
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  formatDate(date: Date): string {
    if (!date) return 'Fecha no disponible';
    return new Date(date).toLocaleString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santiago'
    });
  }

  getTimeUntilNotification(scheduledAt: Date): string {
    if (!scheduledAt) return '';
    
    const now = new Date();
    const diff = new Date(scheduledAt).getTime() - now.getTime();
    
    if (diff <= 0) return 'Ya pasó';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `En ${days}d ${hours}h`;
    if (hours > 0) return `En ${hours}h ${minutes}m`;
    return `En ${minutes}m`;
  }

  getNotificationTypeIcon(type: string): string {
    switch (type) {
      case 'episode': return 'play-circle-outline';
      case 'premiere': return 'star-outline';
      case 'reminder': return 'time-outline';
      default: return 'notifications-outline';
    }
  }

  getNotificationTypeText(type: string): string {
    switch (type) {
      case 'episode': return 'Nuevo episodio';
      case 'premiere': return 'Estreno';
      case 'reminder': return 'Recordatorio';
      default: return 'Notificación';
    }
  }

  async requestPermissions() {
    try {
      await this.notificationService.requestPermission();
      const toast = await this.toastCtrl.create({
        message: 'Permisos de notificación otorgados',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
      await this.loadNotificationData();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: 'No se pudieron obtener los permisos de notificación',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  async refreshNotifications() {
    const alert = await this.alertCtrl.create({
      header: 'Refrescar Notificaciones',
      message: 'Esto cancelará todas las notificaciones actuales y volverá a programarlas con los datos más recientes. ¿Continuar?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Refrescar',
          handler: async () => {
            try {
              // Cancelar todas las notificaciones existentes
              await this.notificationService.cancelAllNotifications();
              
              // Recargar la página principal para que se vuelvan a programar
              window.location.reload();
              
              const toast = await this.toastCtrl.create({
                message: 'Notificaciones refrescadas. Se están reprogramando...',
                duration: 3000,
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: 'Error al refrescar notificaciones',
                duration: 3000,
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}