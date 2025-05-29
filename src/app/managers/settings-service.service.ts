import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from '../../managers/StorageService';

export interface AppSettings {
  darkMode: boolean;
  animations: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // en minutos
  notifications: boolean;
  language: 'es' | 'en';
}

@Injectable({
  providedIn: 'root'
})
export class SettingsServiceService {
  private defaultSettings: AppSettings = {
    darkMode: false,
    animations: true,
    autoRefresh: true,
    refreshInterval: 120, // 2 horas
    notifications: true,
    language: 'es'
  };

  private settingsSubject = new BehaviorSubject<AppSettings>(this.defaultSettings);
  public settings$ = this.settingsSubject.asObservable();

  constructor(private storageService: StorageService) {
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const savedSettings = await this.storageService.get('app_settings');
      if (savedSettings) {
        const settings = { ...this.defaultSettings, ...savedSettings };
        this.settingsSubject.next(settings);
        this.applySettings(settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const currentSettings = this.settingsSubject.value;
    const newSettings = { ...currentSettings, [key]: value };
    
    try {
      await this.storageService.set('app_settings', newSettings);
      this.settingsSubject.next(newSettings);
      this.applySettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  private applySettings(settings: AppSettings) {
    // Aplicar modo oscuro
    document.body.classList.toggle('dark', settings.darkMode);
    
    // Aplicar configuración de animaciones
    document.body.classList.toggle('no-animations', !settings.animations);
  }

  async toggleDarkMode() {
    const current = this.settingsSubject.value.darkMode;
    await this.updateSetting('darkMode', !current);
  }

  async toggleAnimations() {
    const current = this.settingsSubject.value.animations;
    await this.updateSetting('animations', !current);
  }

  getCurrentSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  async resetToDefaults() {
    try {
      await this.storageService.remove('app_settings');
      this.settingsSubject.next(this.defaultSettings);
      this.applySettings(this.defaultSettings);
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  }
}
