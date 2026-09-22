import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from 'src/managers/StorageService';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
})
export class SplashPage implements OnInit {
  constructor(private router: Router, private storageService: StorageService, private fireAuth: AngularFireAuth) {}

  async ionViewDidEnter() {
    const user = await firstValueFrom(this.fireAuth.authState);
    await this.router.navigateByUrl(user ? '/tab/home' : '/login', { replaceUrl: true });
  }

  async ngOnInit() {
  }
}
