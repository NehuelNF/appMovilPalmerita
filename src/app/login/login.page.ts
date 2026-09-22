import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { UserLoginUseCase } from 'src/app/use-cases/user-login.use-case';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  identifier: string = '';
  password: string = '';

  constructor(
    private userLoginUseCase: UserLoginUseCase,
    private router: Router,
    private loadingController: LoadingController
  ) {}

  async ionViewDidEnter() {
    try {
      await this.userLoginUseCase.checkGoogleRedirectResult();
    } catch (error: any) {
      console.error('No se pudo completar el inicio con Google:', error);
      this.error = error?.message || 'No se pudo completar el inicio con Google.';
    }
  }

  async onLoginButtonPressed() {
    const loading = await this.loadingController.create({
      message: 'Iniciando sesión...',
      spinner: 'crescent'
    });
    await loading.present();
    try {
      await this.userLoginUseCase.loginUser(this.identifier, this.password);
    } catch (error: any) {
      this.error = error?.message || 'No se pudo iniciar sesión.';
    } finally {
      await loading.dismiss();
    }
  }

  async googleLogin() {
    this.error = '';
    try {
      // Invocar el popup en el mismo gesto del botón para que Safari no lo bloquee.
      await this.userLoginUseCase.loginWithGoogle();
    } catch (error: any) {
      this.error = error?.message || 'No se pudo iniciar sesión con Google.';
    }
  }

  error = '';

  onRegisterButtonPressed() {
    this.router.navigate(['/register']);
  }
}
