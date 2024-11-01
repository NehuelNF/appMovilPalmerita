import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { StorageService } from 'src/managers/StorageService';

interface UserData {
  username: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserGetUseCase {
  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private storageService: StorageService
  ) {}

  async getUserName(): Promise<string | null> {
    const username = await this.storageService.get('username');
    if (username) {
      return username;
    }

    const user = await this.fireAuth.currentUser;
    if (user) {
      const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
      const userData = userDoc ? userDoc.data() as UserData : null;
      return userData ? userData.username : null;
    }
    return null;
  }
}