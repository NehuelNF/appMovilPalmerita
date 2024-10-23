// src/app/managers/AnimeService.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface AnimeResponse {
  data: any[];
  pagination: any;
}

@Injectable({
  providedIn: 'root'
})
export class AnimeService {
  private baseUrl = 'https://api.jikan.moe/v4';

  constructor(private http: HttpClient) {}

  getSeasonalAnime(): Observable<AnimeResponse> {
    return this.http.get<AnimeResponse>(`${this.baseUrl}/seasons/now`);
  }

  // Método opcional para obtener un anime específico
  getAnimeById(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/anime/${id}`);
  }
}