import { Injectable } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import { CameraService } from './CameraService';
import { UpdateAvatarUseCase } from 'src/app/use-cases/update-avatar.use-case';

@Injectable({
  providedIn: 'root'
})

export class ActionSheetService {

  constructor(
    private actionSheetCtrl: ActionSheetController,
    private cameraService: CameraService,
    private updateAvatarUseCase: UpdateAvatarUseCase
  ) {}

  async presentActionSheet() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opciones',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel',
          icon: 'close',
          handler: () => {
            console.log('Cerrar clicked');
          }
        },
        {
          text: 'Cámara',
          icon: 'camera',
          handler: async () => {
            console.log('Cámara clicked');
            const base64Image = await this.cameraService.takePicture();
            if (base64Image) {
              await this.updateAvatarUseCase.updateAvatar(base64Image);
            }
          }
        },
        {
          text: 'Biblioteca',
          icon: 'image',
          handler: () => {
            console.log('Biblioteca clicked');
            // Lógica para abrir la biblioteca
          }
        }
      ]
    });
    await actionSheet.present();
  }
}