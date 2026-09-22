import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Platform } from '@ionic/angular';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  constructor(
    private afAuth: AngularFireAuth,
    private platform: Platform
  ) {}

  async signIn() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({ prompt: 'select_account' });

      try {
        const result = await this.afAuth.signInWithPopup(provider);
        if (result.user) {
          return {
            id: result.user.uid,
            email: result.user.email,
            name: result.user.displayName,
            imageUrl: result.user.photoURL
          };
        }
      } catch (popupError: any) {
        console.warn('signInWithPopup falló o fue bloqueado, intentando con Redirect:', popupError);
        // Si popup fue bloqueado en navegadores móviles o web, intentar signInWithRedirect
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
          await this.afAuth.signInWithRedirect(provider);
          return null;
        }
        throw popupError;
      }

      throw new Error('No se pudo autenticar');
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      throw error;
    }
  }

  async getRedirectResult() {
    try {
      const result = await this.afAuth.getRedirectResult();
      if (result && result.user) {
        return {
          id: result.user.uid,
          email: result.user.email,
          name: result.user.displayName,
          imageUrl: result.user.photoURL
        };
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo resultado de redirección:', error);
      return null;
    }
  }

  async signOut() {
    try {
      await this.afAuth.signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  }
}