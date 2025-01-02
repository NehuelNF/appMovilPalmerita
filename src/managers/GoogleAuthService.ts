import { Injectable } from '@angular/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  constructor(private platform: Platform) {
    this.initialize();
  }

  async initialize() {
    if (this.platform.is('android')) {
      await GoogleAuth.initialize();
    }
  }

  async signIn() {
    try {
      const user = await GoogleAuth.signIn();
      return user;
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      await GoogleAuth.signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  }
}