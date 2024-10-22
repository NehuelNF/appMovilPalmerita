import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { sessionService } from 'src/managers/sessionService';
import { StorageService } from 'src/managers/storageService';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  email: string = '';
  username: string = '';
  password: string = '';

  constructor(
    private sessionService: sessionService,  // Cambia a PascalCase
    private storageService: StorageService, 
    private router: Router
  ) {}

  ngOnInit() {}

  async onRegisterButtonPressed() {
    if (this.sessionService.register(this.username, this.password, this.email)) {
      this.router.navigate(['/login']);
      await this.storageService.setUsername(this.username);
    } else {
      alert('Error en el registro. El email o nombre de usuario ya existe.');
    }
  }
}
