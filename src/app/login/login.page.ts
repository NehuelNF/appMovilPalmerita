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
  
  identifier: string = '';
  password: string = '';

  ngOnInit() {
  }
  
  async onLoginButtonPressed() {
    try {
      const userCredential = await this.sessionService.loginWith(this.identifier, this.password);
      const user = userCredential.user;
      if (user) {
        console.log('Usuario autenticado:', user);
        this.router.navigate(['/tab/home']);
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    }
  }

  onRegisterButtonPressed() {
    this.router.navigate(['/register']);
  }

}