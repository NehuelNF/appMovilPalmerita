import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private afAuth: AngularFireAuth) {}

  async linkAccountWithGoogle(googleEmail: string): Promise<void> {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const currentUser = await this.afAuth.currentUser;
      
      if (!currentUser) {
        throw new Error('No hay usuario autenticado');
      }

      await currentUser.linkWithPopup(provider);
    } catch (error) {
      console.error('Error linking account:', error);
      throw error;
    }
  }
}