import { Component, OnInit } from '@angular/core';
import { UserGetUseCase } from 'src/app/use-cases/user-get.use-case';
import { UserLogoutUseCase } from 'src/app/use-cases/user-logout.use-case';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit {
  userName: string | null = null;

  constructor(
    private userGetUseCase: UserGetUseCase,
    private userLogoutUseCase: UserLogoutUseCase
  ) {}

  async ngOnInit() {
    this.userName = await this.userGetUseCase.getUserName();
  }

  async onLogoutButtonPressed() {
    await this.userLogoutUseCase.logoutUser();
  }
}