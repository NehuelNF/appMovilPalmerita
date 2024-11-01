import { Component, OnInit } from '@angular/core';
import { SessionService } from 'src/managers/SessionServicee';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit {

  userName: string | undefined;

  constructor(private sessionService: SessionService) { }

  async ngOnInit() {
    const profile = await this.sessionService.getProfile();
    if (profile) {
      this.userName = profile.username;
    }
  }
}