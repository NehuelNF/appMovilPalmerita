import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserLoginUseCase } from 'src/app/use-cases/user-login.use-case';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  
  identifier: string = '';
  password: string = '';

  constructor(private userLoginUseCase: UserLoginUseCase, private router: Router) {}

  ngOnInit() {}

  async onLoginButtonPressed() {
    await this.userLoginUseCase.loginUser(this.identifier, this.password);
  }

  onRegisterButtonPressed() {
    this.router.navigate(['/register']);
  }
}