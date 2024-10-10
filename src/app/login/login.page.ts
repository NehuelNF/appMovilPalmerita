import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { sessionService } from 'src/managers/sessionService';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(private router: Router, private sessionService: sessionService) { }

  identifier: string = '';
  password: string = '';

  ngOnInit() {
  }

  onLoginButtonPressed() {
    console.log('Intentando iniciar sesión con:', this.identifier);

    if (!this.identifier || !this.password) {
      console.log('Login fallido: Campos vacíos');
      alert('Por favor, complete todos los campos.');
      return;
    }

    if (this.sessionService.login(this.identifier, this.password)) {
      this.router.navigate(['/tab/home']);
    } else {
      console.log('Login fallido');
      alert('Nombre de usuario o contraseña incorrectos.');
    }
  }

  onRegisterButtonPressed() {
    this.router.navigate(['/register']);
  }
}