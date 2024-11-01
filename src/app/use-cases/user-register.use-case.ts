import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { CancelAlertService } from 'src/managers/CancelAlertService';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class UserRegisterUseCase {
    
  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private alert: CancelAlertService
  ) {}

  async registerUser(email: string, password: string, username: string): Promise<void> {
    try {
      const userCredential = await this.fireAuth.createUserWithEmailAndPassword(email, password);
      await this.firestore.collection('users').doc(userCredential.user?.uid).set({
        email: email,
        username: username,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const user = userCredential.user;
      if (user) {
        this.alert.showAlert(
          'Registro exitoso',
          'Ya eres parte de nuestro sistema',
          () => {
            this.router.navigate(['/splash']);
          }
        );
      } else {
        alert('¡Registro exitoso!');
      }
      this.router.navigate(['/splash']);
    } catch (error: any) {
      console.error('Error during registration:', error);
      switch (error.code) {
        case 'auth/email-already-in-use':
          this.alert.showAlert(
            'Error',
            'Este correo electrónico ya está en uso. Por favor, utiliza otro o inicia sesión.',
            () => {
              this.clean();
            }
          );
          break;
        case 'auth/invalid-email':
          this.alert.showAlert(
            'Error',
            'La dirección de correo electrónico no es válida.',
            () => {
              this.clean();
            }
          );
          break;
        case 'auth/weak-password':
          this.alert.showAlert(
            'Error',
            'La contraseña es muy débil.',
            () => {
              this.clean();
            }
          );
          break;
        default:
          this.alert.showAlert(
            'Error',
            'Ocurrió un error al registrar el usuario: ' + error.message,
            () => {
              this.clean();
            }
          );
          break;
      }
    }
  }

  clean() {
  }
}