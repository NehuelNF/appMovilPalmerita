import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  topAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private animeService: AnimeService) {}

  ngOnInit() {
    this.loadTopAnimes();
  }

  loadTopAnimes() {
    this.isLoading = true;
    this.animeService.getTopAnime().subscribe({
      next: (response: any) => {
        this.topAnimes = response.data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los animes top';
        this.isLoading = false;
        console.error('Error:', err);
      }
    });
  }
}
