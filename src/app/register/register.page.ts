import { Component, OnInit } from '@angular/core';
import { UserRegisterUseCase } from 'src/app/use-cases/user-register.use-case';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage implements OnInit {
  username: string = '';
  email: string = '';
  password: string = '';

  constructor(private userRegisterUseCase: UserRegisterUseCase, private router : Router) {}

  ngOnInit() {}

  async onRegisterButtonPressed() {
    await this.userRegisterUseCase.registerUser(this.email, this.password, this.username);
    this.router.navigate(['/login']);
  }

  async googleRegister() {
    await this.userRegisterUseCase.registerWithGoogle();
  }

  clean() {
    this.username = '';
    this.email = '';
    this.password = '';
  }
}