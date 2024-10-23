import { Component, OnInit } from '@angular/core';
import { AnimeService } from '../../../managers/AnimeService';

@Component({
  selector: 'app-season',
  templateUrl: './season.page.html',
  styleUrls: ['./season.page.scss'],
})
export class SeasonPage implements OnInit {
  animes: any[] = [];
  filteredAnimes: any[] = [];
  isLoading = true;
  error: string | null = null;
  selectedDay: string = 'all';

  constructor(private animeService: AnimeService) { }

  ngOnInit() {
    this.loadAnimes();
  }

  daysMap: { [key: string]: string } = {
    monday: 'mondays',
    tuesday: 'tuesdays',
    wednesday: 'wednesdays',
    thursday: 'thursdays',
    friday: 'fridays',
    saturday: 'saturdays',
    sunday: 'sundays'
  };

  loadAnimes() {
    this.isLoading = true;
    this.animeService.getSeasonalAnime().subscribe({
      next: (response: any) => {
        this.animes = response.data;
        this.filteredAnimes = this.animes;
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = 'Error al cargar los animes de temporada';
        this.isLoading = false;
        console.error('Error:', err);
      }
    });
  }

  filterAnimesByDay() {
    // console.log('Selected Day:', this.selectedDay);
    if (this.selectedDay === 'all') {
      this.filteredAnimes = this.animes;
    } else {
      const selectedDayPlural = this.daysMap[this.selectedDay.toLowerCase()];
      this.filteredAnimes = this.animes.filter(anime => {
        const broadcastDay = anime.broadcast?.day?.toLowerCase();
        // console.log('Broadcast Day:', broadcastDay);
        return broadcastDay === selectedDayPlural;
      });
    }
  }

  handleRefresh(event: any) {
    this.loadAnimes();
    event.target.complete();
  }
}
