
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { CancelAlertService } from 'src/managers/CancelAlertService';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class UserProfileUseCase {
  constructor(
    private fireAuth: AngularFireAuth,
    private alert: CancelAlertService
  ) {}

  async linkWithGoogle(): Promise<void> {
    try {
      const currentUser = await this.fireAuth.currentUser;
      if (!currentUser) {
        throw new Error('No hay usuario autenticado');
      }

      const provider = new firebase.auth.GoogleAuthProvider();
      await currentUser.linkWithPopup(provider);

      this.alert.showAlert(
        'Éxito',
        'Tu cuenta ha sido vinculada con Google correctamente',
        () => {}
      );
    } catch (error: any) {
      let errorMessage = 'Error al vincular cuenta con Google';
      
      if (error.code === 'auth/credential-already-in-use') {
        errorMessage = 'Esta cuenta de Google ya está vinculada a otra cuenta';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'El popup fue bloqueado. Por favor, permite las ventanas emergentes';
      }

      this.alert.showAlert(
        'Error',
        errorMessage,
        () => {}
      );
    }
  }
}