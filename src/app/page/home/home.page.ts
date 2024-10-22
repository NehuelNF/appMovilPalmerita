import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { sessionService } from 'src/managers/sessionService';
import { StorageService } from 'src/managers/storageService';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  username: string | null = '';

  constructor(
    private sessionService: sessionService,
    private storageService: StorageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsername();
  }

  async ionViewWillEnter() {
    this.loadUsername(); // Asegúrate de cargar el nombre de usuario cuando la vista se vuelve a mostrar
  }

  async loadUsername() {
    this.username = await this.storageService.getUsername();
    console.log('Username loaded in Home:', this.username); // Para verificar que se carga correctamente
  }

  onLogout() {
    this.router.navigate(['/login']);
  }
}