import { Component, OnInit } from '@angular/core';
import { sessionService } from 'src/managers/sessionService';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {

  email: string = '';
  username: string = '';
  password: string = '';

  constructor(private sessionService: sessionService, private router: Router) { }

  ngOnInit() {
  }

  onRegisterButtonPressed() {
    if (this.sessionService.register(this.username, this.password, this.email)) {
      this.router.navigate(['/login']);
    } else {
      alert('Error en el registro. El email o nombre de usuario ya existe.');
    }
  }

}