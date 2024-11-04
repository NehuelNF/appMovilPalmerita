import { Component, OnInit } from '@angular/core';
import { UserGetUseCase } from 'src/app/use-cases/user-get.use-case';
import { UserLogoutUseCase } from 'src/app/use-cases/user-logout.use-case';
import { Router } from '@angular/router';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit {
  userName: string | null = null;

  constructor(
    private userGetUseCase: UserGetUseCase,
    private userLogoutUseCase: UserLogoutUseCase,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      this.userName = await this.userGetUseCase.getUserName();
      if (!this.userName) {
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error al obtener nombre de usuario:', error);
      this.router.navigate(['/login']);
    }
  }

  async onLogoutButtonPressed() {
    try {
      await this.userLogoutUseCase.logoutUser();
      this.userName = null;
    } catch (error) {
      console.error('Error durante el logout:', error);
    }
  }
}