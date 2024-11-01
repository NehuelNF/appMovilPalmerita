import { Component, OnInit } from '@angular/core';
import { UserGetUseCase } from 'src/app/use-cases/user-get.use-case';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit {

  userName: string | null = null;

  constructor(private userGetUseCase : UserGetUseCase) { }

  async ngOnInit() {
    this.userName = await this.userGetUseCase.getUserName();
  }
}