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
      if (!user) {
        // En caso de signInWithRedirect, la página redirigirá a Google
        return;
      }

      await this.processAuthenticatedUser(user);
    } catch (error: any) {
      console.error('Error en login con Google:', error);
      
      let errorMsg = 'Error al iniciar sesión con Google. Intenta nuevamente';
      if (error.code === 'auth/popup-closed-by-user') {
        errorMsg = 'Login cancelado por el usuario.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMsg = 'Este dominio (ej. localhost o tu host actual) no está autorizado en la consola de Firebase Authentication -> Settings -> Authorized domains.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMsg = 'El proveedor de inicio de sesión con Google no está habilitado en Firebase Authentication.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMsg = 'Error de conexión. Verifica tu internet.';
      } else if (error.code === 'auth/configuration-not-found') {
        errorMsg = 'Configuración de Google OAuth no encontrada en Firebase.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      await this.alert.showAlert('Autenticación Google', errorMsg, () => {});
      throw error;
    }
  }

  async checkGoogleRedirectResult(): Promise<void> {
    const user = await this.googleAuthService.getRedirectResult();
    if (user) {
      await this.processAuthenticatedUser(user);
    }
  }

  private async processAuthenticatedUser(user: { id: string; email: string | null; name: string | null; imageUrl: string | null }): Promise<void> {
    if (!user || !user.email) {
      throw new Error('No se pudo obtener la información del usuario');
    }

    // Determinar el username a usar (preferir el nombre real sobre el email)
    let usernameToSave = user.name;
    if (!usernameToSave || usernameToSave.trim() === '') {
      usernameToSave = user.email.split('@')[0];
    }
    
    // Verificar si el usuario ya existe en Firestore
    const userDoc = await this.firestore
      .collection('users')
      .doc(user.id)
      .get()
      .toPromise();

    if (!userDoc?.exists) {
      await this.firestore.collection('users').doc(user.id).set({
        email: user.email,
        username: usernameToSave,
        displayName: user.name,
        photoURL: user.imageUrl,
        provider: 'google',
        createdAt: new Date()
      });
    } else {
      const existingData = userDoc.data() as any;
      const updateData: any = {};
      
      if (!existingData.username || 
          existingData.username.includes('@') || 
          existingData.username !== usernameToSave) {
        updateData.username = usernameToSave;
      }
      
      if (existingData.displayName !== user.name) {
        updateData.displayName = user.name;
      }
      
      if (existingData.photoURL !== user.imageUrl) {
        updateData.photoURL = user.imageUrl;
      }
      
      if (Object.keys(updateData).length > 0) {
        await this.firestore.collection('users').doc(user.id).update(updateData);
      }
    }

    await this.storageService.set('username', usernameToSave);
    await this.storageService.set('userEmail', user.email);
    await this.router.navigate(['/tab/home']);
  }
}