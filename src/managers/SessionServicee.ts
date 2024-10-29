import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  constructor(private afAuth: AngularFireAuth) {}

  // Método para iniciar sesión con email y contraseña
  login(email: string, password: string) {
    return this.afAuth.signInWithEmailAndPassword(email, password);
  }

  // Método para registrarse con email y contraseña
  register(email: string, password: string) {
    return this.afAuth.createUserWithEmailAndPassword(email, password);
  }

  // Método para cerrar sesión
  logout() {
    return this.afAuth.signOut();
  }

  // Método para obtener el usuario actual
  getUser() {
    return this.afAuth.authState;
  }
}