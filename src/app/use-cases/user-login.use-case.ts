import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { StorageService } from 'src/managers/StorageService';
import { CancelAlertService } from 'src/managers/CancelAlertService';
import firebase from 'firebase/compat/app';
import { GoogleAuthService } from '../../managers/GoogleAuthService';

@Injectable({
  providedIn: 'root'
})

export class UserLoginUseCase {
  
  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private storageService: StorageService,
    private alert: CancelAlertService,
    private googleAuthService: GoogleAuthService
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

  async loginWithGoogle(): Promise<void> {
    try {
      console.log('Iniciando login con Google...');
      const user = await this.googleAuthService.signIn();
      
      if (user && user.email) {
        console.log('Usuario autenticado:', user);
        
        // Determinar el username a usar (preferir el nombre real sobre el email)
        let usernameToSave = user.name;
        if (!usernameToSave || usernameToSave.trim() === '') {
          // Si no hay nombre, usar la parte antes del @ del email
          usernameToSave = user.email.split('@')[0];
        }
        
        // Verificar si el usuario ya existe en Firestore
        const userDoc = await this.firestore
          .collection('users')
          .doc(user.id)
          .get()
          .toPromise();

        if (!userDoc?.exists) {
          // Si es un nuevo usuario, crear registro en Firestore
          await this.firestore.collection('users').doc(user.id).set({
            email: user.email,
            username: usernameToSave,
            displayName: user.name,
            photoURL: user.imageUrl,
            provider: 'google',
            createdAt: new Date()
          });
        } else {
          // Si el usuario ya existe, actualizar la información si es necesario
          const existingData = userDoc.data() as any;
          const updateData: any = {};
          
          // Actualizar el username si cambió o si era un email
          if (!existingData.username || 
              existingData.username.includes('@') || 
              existingData.username !== usernameToSave) {
            updateData.username = usernameToSave;
          }
          
          // Actualizar otros campos si han cambiado
          if (existingData.displayName !== user.name) {
            updateData.displayName = user.name;
          }
          
          if (existingData.photoURL !== user.imageUrl) {
            updateData.photoURL = user.imageUrl;
          }
          
          // Solo actualizar si hay cambios
          if (Object.keys(updateData).length > 0) {
            await this.firestore.collection('users').doc(user.id).update(updateData);
          }
        }

        // Siempre guardar el nombre real del usuario en storage (no el email)
        await this.storageService.set('username', usernameToSave);
        await this.storageService.set('userEmail', user.email);
        
        console.log('Username guardado:', usernameToSave);
        
        await this.router.navigate(['/tab/home']);
      } else {
        throw new Error('No se pudo obtener la información del usuario');
      }
    } catch (error: any) {
      console.error('Error en login con Google:', error);
      
      // Mostrar mensaje de error más específico usando el método correcto del servicio
      if (error.code === 'auth/popup-closed-by-user') {
        await this.alert.showAlert('Información', 'Login cancelado por el usuario', () => {});
      } else if (error.code === 'auth/network-request-failed') {
        await this.alert.showAlert('Error', 'Error de conexión. Verifica tu internet', () => {});
      } else if (error.code === 'auth/configuration-not-found') {
        await this.alert.showAlert('Error', 'Configuración de Google no encontrada', () => {});
      } else {
        await this.alert.showAlert('Error', 'Error al iniciar sesión con Google. Intenta nuevamente', () => {});
      }
      
      throw error;
    }
  }
}