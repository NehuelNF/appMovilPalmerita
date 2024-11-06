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
      let email = identifier;

      // Si no es un email, buscar el email asociado al username
      if (!identifier.includes('@')) {
        
        const usersRef = this.firestore.collection('users');
        const querySnapshot = await usersRef
          .ref
          .where('username', '==', identifier)
          .get();

        if (querySnapshot.empty) {
          throw new Error('Usuario no encontrado');
        }

        const userData = querySnapshot.docs[0].data() as { email?: string };
        if (!userData || !userData['email']) {
          throw new Error('Datos de usuario inválidos');
        }

        email = userData['email'];
      }

      // Autenticar con el email
      userCredential = await this.fireAuth.signInWithEmailAndPassword(email, password);

      if (userCredential.user) {
        // Obtener datos del usuario
        const userDoc = await this.firestore
          .collection('users')
          .doc(userCredential.user.uid)
          .get()
          .toPromise();

        if (userDoc?.exists) {

          const userData = userDoc.data() as { username?: string };
          
          if (userData && userData['username']) {
            await this.storageService.set('username', userData['username']);
            this.router.navigate(['/tab/home']);
          }
        }
      }
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  }
}