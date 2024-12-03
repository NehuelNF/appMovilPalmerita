import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  async takePicture(): Promise<string | null> {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false, // Desactivamos edición para evitar problemas
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        direction: CameraDirection.Front, // Permitir cámara frontal
        width: 1024,
        height: 1024,
        correctOrientation: true // Corregir orientación automáticamente
      });

      if (image.base64String) {
        return image.base64String;
      }
      return null;
    } catch (error) {
      console.error('Error al tomar la foto:', error);
      return null;
    }
  }
}