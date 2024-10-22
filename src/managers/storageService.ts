import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {
    this.init();
  }

  // Inicializa el storage
  async init() {
    const storage = await this.storage.create();
    this._storage = storage;
  }

  // Guarda el nombre de usuario
  async setUsername(username: string) {
    await this._storage?.set('username', username);
  }

  // Obtiene el nombre de usuario
  async getUsername(): Promise<string | null> {
    return await this._storage?.get('username');
  }

  async clear() {
    await this._storage?.clear();  
  }
}