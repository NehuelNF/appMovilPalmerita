import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AnimeService } from '../../../managers/AnimeService';

@Component({
  selector: 'app-anime-detail',
  templateUrl: './anime-detail.page.html',
  styleUrls: ['./anime-detail.page.scss']
})
export class AnimeDetailPage implements OnInit {
  anime: any;
  isLoading: boolean = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private animeService: AnimeService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAnimeDetails(Number(id));
    }
  }

  loadAnimeDetails(id: number) {
    this.isLoading = true;
    this.animeService.getAnimeById(id).subscribe({
      next: (response: any) => {
        this.anime = response.data;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los detalles del anime';
        this.isLoading = false;
        console.error('Error:', err);
      }
    });
  }

  getImageUrl(): string {
    return this.anime?.images?.jpg?.image_url || 'assets/default-image.png';
  }

  getGenres(): string {
    return this.anime?.genres?.map((genre: any) => genre.name).join(', ') || 'Desconocido';
  }

  hasTrailer(): boolean {
    return !!this.anime?.trailer?.url;
  }

  openTrailer() {
    if (this.anime?.trailer?.url) {
      window.open(this.anime.trailer.url, '_blank');
    }
  }
}