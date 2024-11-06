// src/app/use-cases/user-update.use-case.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { StorageService } from 'src/managers/StorageService';

@Injectable({
    providedIn: 'root'
  })
  export class UserUpdateUseCase {
    constructor(
      private fireAuth: AngularFireAuth,
      private firestore: AngularFirestore,
      private storageService: StorageService
    ) {}
  
    private async isUsernameTaken(username: string, currentUserId: string): Promise<boolean> {
      const querySnapshot = await this.firestore
        .collection('users')
        .ref
        .where('username', '==', username)
        .get();
  
      // Verificar si existe otro usuario con ese nombre excepto el actual
      return querySnapshot.docs.some(doc => doc.id !== currentUserId);
    }
  
    async updateUsername(newUsername: string): Promise<void> {
      try {
        const user = await this.fireAuth.currentUser;
        if (!user) {
          throw new Error('No hay usuario autenticado');
        }
  
        // Verificar si el nombre ya existe
        const isTaken = await this.isUsernameTaken(newUsername, user.uid);
        if (isTaken) {
          throw new Error('Este nombre de usuario ya está en uso');
        }
  
        // Actualizar en Firestore
        await this.firestore.collection('users').doc(user.uid).update({
          username: newUsername
        });
  
        // Actualizar en Storage local
        await this.storageService.set('username', newUsername);
  
      } catch (error) {
        console.error('Error al actualizar nombre:', error);
        throw error;
      }
    }
  }