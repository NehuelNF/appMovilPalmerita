import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;
  private initialization: Promise<void> | null = null;

  constructor(private storage: Storage) {}

  init(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.storage.create().then(storage => {
        this._storage = storage;
      }).catch(error => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  async set(key: string, value: any): Promise<void> {
    await this.init();
    await this._storage!.set(key, value);
  }

  async get(key: string): Promise<any> {
    await this.init();
    return this._storage!.get(key);
  }

  async remove(key: string): Promise<void> {
    await this.init();
    await this._storage!.remove(key);
  }

  async clear(): Promise<void> {
    await this.init();
    await this._storage!.clear();
  }
}
