import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from 'src/managers/SessionServicee';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  email: string = '';
  username: string = '';
  password: string = '';

  constructor(private sessionService: SessionService, private router: Router) { }

  ngOnInit() {
  }

  onRegisterButtonPressed() {
    this.sessionService.register(this.email, this.password)
      .then((res) => {
        console.log('Registro exitoso', res);
        this.router.navigate(['/login']);
      })
      .catch((err) => {
        console.log('Error en el registro', err);
        alert('Error en el registro. El email o nombre de usuario ya existe.');
      });
  }
}