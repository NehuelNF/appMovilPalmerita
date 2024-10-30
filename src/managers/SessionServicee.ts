import { Injectable } from '@angular/core';

//Fire base
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})

export class SessionService {

  constructor(private fireAuth: AngularFireAuth) {}

  private readonly temporaryUserName: string = 'user';
  private readonly temporaryPass: string = 'pass';


  performLogin(user: string, password: string): boolean {
    if(user == this.temporaryUserName && password == this.temporaryPass) {
        return true;
    } else {
        return false;
    }
  }
  
  async registerUserWith(email: string, password: string) : Promise<any> {
    return await this.fireAuth.createUserWithEmailAndPassword(email, password)
  }

  async loginWith(email: string, password: string) : Promise<any> {
      return await this.fireAuth.signInWithEmailAndPassword(email, password)
  }

  async getProfile() {
    return await this.fireAuth.currentUser
}
}
