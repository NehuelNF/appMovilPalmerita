import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root', 
})

export class CancelAlertService {

  constructor(private alertController: AlertController) {}

  async showAlert(header: string, message: string, onConfirm: () => void, onCancel?: () => void) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: () => {
            if (onCancel) {
              onCancel();  
            }
          }
        },
        {
          text: 'Aceptar',
          handler: () => {
            onConfirm();  
          }
        }
      ]
    });

    await alert.present(); 
  }
}