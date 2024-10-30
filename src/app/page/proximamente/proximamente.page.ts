import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';

@Component({
  selector: 'app-proximamente',
  templateUrl: './proximamente.page.html',
  styleUrls: ['./proximamente.page.scss'],
})
export class ProximamentePage implements OnInit {
  upcomingAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private animeService: AnimeService) {}

  ngOnInit() {
    this.loadUpcomingAnimes();
  }

  loadUpcomingAnimes() {
    this.isLoading = true;
    this.animeService.getUpcomingAnime().subscribe({
      next: (response: any) => {
        this.upcomingAnimes = response.data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los animes próximos a estrenarse';
        this.isLoading = false;
        console.error('Error:', err);
      }
    });
  }
}