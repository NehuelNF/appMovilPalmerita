import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { UserLoginUseCase } from 'src/app/use-cases/user-login.use-case';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  identifier: string = '';
  password: string = '';

  constructor(
    private userLoginUseCase: UserLoginUseCase,
    private router: Router,
    private loadingController: LoadingController
  ) {}

  async ngOnInit() {
    await this.userLoginUseCase.checkGoogleRedirectResult();
  }

  async onLoginButtonPressed() {
    const loading = await this.loadingController.create({
      message: 'Iniciando sesión...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      await this.userLoginUseCase.loginUser(this.identifier, this.password);
    } finally {
      await loading.dismiss();
    }
  }

  async googleLogin() {
    const loading = await this.loadingController.create({
      message: 'Conectando con Google...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      await this.userLoginUseCase.loginWithGoogle();
    } finally {
      await loading.dismiss();
    }
  }

  onRegisterButtonPressed() {
    this.router.navigate(['/register']);
  }
}