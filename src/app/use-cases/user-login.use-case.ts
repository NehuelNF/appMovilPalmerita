import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class UserLoginUseCase {
  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router
  ) {}

  async loginUser(identifier: string, password: string): Promise<void> {
    try {
      let userCredential;
      if (identifier.includes('@')) {
        // Login with email
        userCredential = await this.fireAuth.signInWithEmailAndPassword(identifier, password);
      } else {
        // Login with username
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
        console.log('Usuario autenticado:', user);
        this.router.navigate(['/tab/home']);
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    }
  }
}