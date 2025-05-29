import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

@Injectable({
  providedIn: 'root'
})
export class ToastServiceService {

  constructor(private toastController: ToastController) { }

  async showToast(
    message: string, 
    type: ToastType = 'info', 
    duration: number = 3000,
    position: 'top' | 'middle' | 'bottom' = 'bottom'
  ) {
    const toastConfig = this.getToastConfig(type);
    
    const toast = await this.toastController.create({
      message: `${toastConfig.icon} ${message}`,
      duration,
      position,
      color: toastConfig.color,
      cssClass: `toast-${type}`,
      buttons: [
        {
          side: 'end',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  async showSuccess(message: string, duration: number = 2500) {
    await this.showToast(message, 'success', duration);
  }

  async showError(message: string, duration: number = 4000) {
    await this.showToast(message, 'error', duration);
  }

  async showWarning(message: string, duration: number = 3500) {
    await this.showToast(message, 'warning', duration);
  }

  async showInfo(message: string, duration: number = 3000) {
    await this.showToast(message, 'info', duration);
  }

  async showFavoriteAdded(animeName: string) {
    await this.showSuccess(`❤️ ${animeName} agregado a favoritos`);
  }

  async showFavoriteRemoved(animeName: string) {
    await this.showInfo(`💔 ${animeName} removido de favoritos`);
  }

  async showRefreshComplete() {
    await this.showSuccess('✨ Animes actualizados correctamente');
  }

  async showConnectionError() {
    await this.showError('🌐 Error de conexión. Verifica tu internet.');
  }

  private getToastConfig(type: ToastType) {
    const configs = {
      success: { 
        icon: '✅', 
        color: 'success' 
      },
      error: { 
        icon: '❌', 
        color: 'danger' 
      },
      warning: { 
        icon: '⚠️', 
        color: 'warning' 
      },
      info: { 
        icon: 'ℹ️', 
        color: 'primary' 
      }
    };

    return configs[type];
  }
}
