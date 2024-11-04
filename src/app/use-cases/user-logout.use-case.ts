import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { StorageService } from 'src/managers/StorageService';

@Injectable({
  providedIn: 'root'
})
export class UserLogoutUseCase {
  constructor(
    private fireAuth: AngularFireAuth,
    private router: Router,
    private storageService: StorageService
  ) {}

  async logoutUser(): Promise<void> {
    try {
      // Primero hacemos signOut de Firebase
      await this.fireAuth.signOut();
      // Limpiamos todo el storage
      await this.storageService.clear(); // Añadir método clear() en StorageService
      // Navegamos al login
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}