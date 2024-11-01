import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { StorageService } from 'src/managers/StorageService';

@Injectable({
  providedIn: 'root'
})
export class UserLoginUseCase {
  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private storageService: StorageService
  ) {}

  async loginUser(identifier: string, password: string): Promise<void> {
    try {
      let userCredential;
      if (identifier.includes('@')) {
        userCredential = await this.fireAuth.signInWithEmailAndPassword(identifier, password);
      } else {
        const userDoc = await this.firestore.collection('users', ref => ref.where('username', '==', identifier)).get().toPromise();
        if (userDoc && !userDoc.empty) {
          const user = userDoc.docs[0].data() as { email: string };
          userCredential = await this.fireAuth.signInWithEmailAndPassword(user.email, password);
        } else {
          throw new Error('Usuario no encontrado');
        }
      }
      const user = userCredential.user;
      if (user) {
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        const userData = userDoc?.data() as { username: string };
        await this.storageService.set('username', userData.username);
        this.router.navigate(['/tab/home']);
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    }
  }
}