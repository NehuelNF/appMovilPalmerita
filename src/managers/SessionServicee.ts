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
  
  async registerUserWith(email: string, password: string, username: string): Promise<any> {
    try {
      const userCredential = await this.fireAuth.createUserWithEmailAndPassword(email, password);
      await this.firestore.collection('users').doc(userCredential.user?.uid).set({
        email: email,
        username: username,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return userCredential;
    } catch (error) {
      console.error('Error during user registration:', error);
      throw error;
    }
  }

  async loginWith(identifier: string, password: string): Promise<any> {
    try {
      let userCredential;
      if (identifier.includes('@')) {
        // Login with email
        userCredential = await this.fireAuth.signInWithEmailAndPassword(identifier, password);
      } else {
        // Login with username
        const userDoc = await this.firestore.collection('users', ref => ref.where('username', '==', identifier)).get().toPromise();
        if (userDoc && !userDoc.empty) {
          const user = userDoc.docs[0].data() as { email: string };
          userCredential = await this.fireAuth.signInWithEmailAndPassword(user.email, password);
        } else {
          throw new Error('Usuario no encontrado');
        }
      }
      return userCredential;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }

  async getProfile() {
    return await this.fireAuth.currentUser
  }
}
