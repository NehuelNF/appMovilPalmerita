import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { sessionService } from 'src/managers/sessionService';
import { StorageService } from 'src/managers/storageService';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(private router: Router, private sessionService: sessionService, private storageService : StorageService) { }

  identifier: string = '';
  password: string = '';

  ngOnInit() {
  }

  async onLoginButtonPressed() {
    console.log('Intentando iniciar sesión con:', this.identifier);

    if (!this.identifier || !this.password) {
      alert('Por favor, complete todos los campos.');
      return;
    }

    if (this.sessionService.login(this.identifier, this.password)) {
      await this.storageService.setUsername(this.identifier);
      this.router.navigate(['/tab/home']);
    } else {
      alert('Nombre de usuario o contraseña incorrectos.');
    }
  }

  onRegisterButtonPressed() {
    this.router.navigate(['/register']);
  }
}