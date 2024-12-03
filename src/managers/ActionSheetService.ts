import { Injectable } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { CameraService } from './CameraService';
import { UpdateAvatarUseCase } from 'src/app/use-cases/update-avatar.use-case';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ActionSheetService {
  constructor(
    private actionSheetCtrl: ActionSheetController,
    private cameraService: CameraService,
    private updateAvatarUseCase: UpdateAvatarUseCase,
    private alertController: AlertController // Añadir esto
  ) {}

  async presentActionSheet() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opciones',
      buttons: [
        {
          text: 'Tomar Foto',
          icon: 'camera',
          handler: async () => {
            try {
              const base64Image = await this.cameraService.takePicture();
              if (base64Image) {
                await this.updateAvatarUseCase.updateAvatar(base64Image);
                await this.showSuccessAlert();
              } else {
                await this.showErrorAlert('No se pudo obtener la imagen');
              }
            } catch (error) {
              console.error('Error:', error);
              await this.showErrorAlert('Error al procesar la imagen');
            }
          }
        },
        {
          text: 'Cancelar',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });
    await actionSheet.present();
  }

  private async showSuccessAlert() {
    const alert = await this.alertController.create({
      header: 'Éxito',
      message: 'Foto actualizada correctamente',
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }
}