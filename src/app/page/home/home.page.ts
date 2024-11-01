import { Component, OnInit } from '@angular/core';
import { SessionService } from 'src/managers/SessionServicee';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  constructor(private sessionService : SessionService) { }

  ngOnInit() {
  }

}
