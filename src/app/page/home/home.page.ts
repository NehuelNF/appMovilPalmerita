import { Component, OnInit } from '@angular/core';
import { sessionService } from 'src/managers/sessionService';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  constructor(private sessionService : sessionService) { }

  ngOnInit() {
  }

  username: string = this.sessionService.getUser()?.username || 'Usuario';
}
