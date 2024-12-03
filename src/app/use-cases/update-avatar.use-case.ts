import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UpdateAvatarUseCase {
  private avatarUpdatedSubject = new Subject<string>();
  avatarUpdated$ = this.avatarUpdatedSubject.asObservable();

  constructor(
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth
  ) {}

  async updateAvatar(base64Image: string): Promise<void> {
    try {
      const user = await this.fireAuth.currentUser;
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Verificar tamaño de la imagen (500MB)
      const sizeInBytes = this.calculateBase64Size(base64Image);
      const sizeInMB = sizeInBytes / (1024 * 1024);
      if (sizeInBytes > 500 * 1024 * 1024) {
        throw new Error(`La imagen es demasiado grande (${sizeInMB.toFixed(2)}MB). Debe ser menor a 500MB.`);
      }

      const userId = user.uid;
      
      // Asegurarse de que la imagen se actualice en Firestore
      await this.firestore.collection('users').doc(userId).set(
        { 
          avatar: base64Image,
          lastUpdated: new Date().toISOString() // Añadir timestamp
        }, 
        { merge: true }
      );

      // Emitir el evento después de confirmar la actualización
      this.avatarUpdatedSubject.next(base64Image);
    } catch (error) {
      console.error('Error al actualizar avatar:', error);
      throw error;
    }
  }

  private calculateBase64Size(base64String: string): number {
    const padding = base64String.endsWith('==') ? 2 : 
                   base64String.endsWith('=') ? 1 : 0;
    return (base64String.length * 0.75) - padding;
  }
}