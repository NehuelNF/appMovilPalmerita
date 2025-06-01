import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WatchEpisodePageRoutingModule } from './watch-episode-routing.module';

import { WatchEpisodePage } from './watch-episode.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WatchEpisodePageRoutingModule
  ],
  declarations: [WatchEpisodePage]
})
export class WatchEpisodePageModule {}
