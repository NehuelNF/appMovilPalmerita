import { Injectable } from '@angular/core';

//Fire base
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})

export class SessionService {

  constructor(private fireAuth: AngularFireAuth, private firestore: AngularFirestore) {}

  private readonly temporaryUserName: string = 'user';
  private readonly temporaryPass: string = 'pass';


  performLogin(user: string, password: string): boolean {
    if(user == this.temporaryUserName && password == this.temporaryPass) {
        return true;
    } else {
        return false;
    }
  }
  
  async registerUserWith(email: string, password: string): Promise<any> {
    try {
      const userCredential = await this.fireAuth.createUserWithEmailAndPassword(email, password);
      await this.firestore.collection('users').doc(userCredential.user?.uid).set({
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return userCredential;
    } catch (error) {
      console.error('Error during user registration:', error);
      throw error;
    }
  }

  async loginWith(email: string, password: string) : Promise<any> {
    return await this.fireAuth.signInWithEmailAndPassword(email, password);
  }

  async getProfile() {
    return await this.fireAuth.currentUser
}
}
