import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from 'src/managers/SessionServicee';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  constructor(private router: Router, private sessionService: SessionService) { }

  email: string = '';
  password: string = '';

  ngOnInit() {
  }

  onLoginButtonPressed() {
    console.log('Intentando iniciar sesión con:', this.email);

    if (!this.email || !this.password) {
      console.log('Login fallido: Campos vacíos');
      alert('Por favor, complete todos los campos.');
      return;
    }

    this.sessionService.login(this.email, this.password)
      .then((res) => {
        console.log('Login exitoso', res);
        this.router.navigate(['/tab/home']);
      })
      .catch((err) => {
        console.log('Login fallido', err);
        alert('Nombre de usuario o contraseña incorrectos.');
      });
  }

  onRegisterButtonPressed() {
    this.router.navigate(['/register']);
  }
}