import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from 'src/managers/StorageService';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
})
export class SplashPage implements OnInit {
  constructor(private router: Router, private storageService: StorageService) {}

  async ngOnInit() {
    await this.storageService.init(); // Asegúrate de que el almacenamiento esté inicializado
    const username = await this.storageService.get('username');
    if (username) {
      this.router.navigate(['/tab/home']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}