import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

export interface SavedLocation {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private geocodingApiUrl = 'https://nominatim.openstreetmap.org/search';

  constructor(
    private http: HttpClient,
    private firestore: AngularFirestore,
    private auth: AngularFireAuth
  ) {}

  async getCurrentLocation() {
    const coordinates = await Geolocation.getCurrentPosition();
    return {
      latitude: coordinates.coords.latitude,
      longitude: coordinates.coords.longitude
    };
  }

  searchLocation(query: string): Observable<any[]> {
    const params = {
      format: 'json',
      q: query,
      limit: 5
    };

    return this.http.get<any[]>(this.geocodingApiUrl, { params }).pipe(
      map(results => results.map(item => ({
        display_name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      })))
    );
  }

  saveLocation(location: Omit<SavedLocation, 'id'>): Observable<SavedLocation> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) throw new Error('Must be logged in');
        
        const locationData: SavedLocation = {
          ...location,
          timestamp: Date.now()
        };

        return from(this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('saved_locations')
          .add(locationData)
        ).pipe(
          map(docRef => ({
            id: docRef.id,
            ...locationData
          }))
        );
      })
    );
  }

  getSavedLocations(): Observable<SavedLocation[]> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) return [];
        return this.firestore
          .collection('users')
          .doc(user.uid)
          .collection<SavedLocation>('saved_locations', ref => ref.orderBy('timestamp', 'desc'))
          .valueChanges({ idField: 'id' });
      })
    );
  }

  deleteLocation(locationId: string): Observable<void> {
    return this.auth.user.pipe(
      switchMap(user => {
        if (!user) throw new Error('Must be logged in');
        return from(this.firestore
          .collection('users')
          .doc(user.uid)
          .collection('saved_locations')
          .doc(locationId)
          .delete()
        );
      })
    );
  }
}
