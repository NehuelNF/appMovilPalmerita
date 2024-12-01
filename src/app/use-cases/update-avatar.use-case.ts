import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UpdateAvatarUseCase {
  private avatarUpdatedSubject = new Subject<string>();
  avatarUpdated$ = this.avatarUpdatedSubject.asObservable();

  constructor(private firestore: AngularFirestore, private fireAuth: AngularFireAuth) {}

  async updateAvatar(base64Image: string): Promise<void> {
    const user = await this.fireAuth.currentUser;
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const userId = user.uid;
    const avatarRef = this.firestore.collection('users').doc(userId);

    await avatarRef.set({ avatar: base64Image }, { merge: true });
    this.avatarUpdatedSubject.next(base64Image);
  }
}