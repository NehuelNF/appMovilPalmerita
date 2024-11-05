// src/app/use-cases/user-delete.use-case.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { StorageService } from 'src/managers/StorageService';

@Injectable({
  providedIn: 'root'
})
export class UserDeleteUseCase {
  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private storageService: StorageService
  ) {}

  async deleteUser(): Promise<void> {
    try {
      const user = await this.fireAuth.currentUser;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      // Eliminar documento del usuario
      await this.firestore.collection('users').doc(user.uid).delete();
      
      // Eliminar autenticación
      await user.delete();
      
      // Limpiar storage
      await this.storageService.clear();
      
      // Navegar al login
      this.router.navigate(['/login']);
      
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      throw error;
    }
  }
}