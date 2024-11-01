import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';

    
interface UserData {
    username: string;
}

@Injectable({
  providedIn: 'root'
})

export class UserGetUseCase {

  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) {}

  

  async getUserName(): Promise<string | null> {
    const user = await this.fireAuth.currentUser;
    if (user) {
      const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
      const userData = userDoc ? userDoc.data() as UserData : null;
      return userData ? userData.username : null;
    }
    return null;
  }
}