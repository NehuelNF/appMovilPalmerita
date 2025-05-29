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
      if (this.platform.is('cordova') || this.platform.is('capacitor')) {
        // Para dispositivos móviles - usar popup
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        
        const result = await this.afAuth.signInWithPopup(provider);
        
        if (result.user) {
          return {
            id: result.user.uid,
            email: result.user.email,
            name: result.user.displayName,
            imageUrl: result.user.photoURL
          };
        }
      } else {
        // Para web - usar redirect
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        
        const result = await this.afAuth.signInWithPopup(provider);
        
        if (result.user) {
          return {
            id: result.user.uid,
            email: result.user.email,
            name: result.user.displayName,
            imageUrl: result.user.photoURL
          };
        }
      }
      
      throw new Error('No se pudo autenticar');
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      throw error;
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