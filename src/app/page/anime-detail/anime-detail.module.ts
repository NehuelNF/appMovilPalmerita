import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AnimeDetailPageRoutingModule } from './anime-detail-routing.module';
import { RouterModule } from '@angular/router';

import { AnimeDetailPage } from './anime-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AnimeDetailPageRoutingModule,
    RouterModule.forChild([
      {
        path: '',
        component: AnimeDetailPage
      }
    ])
  ],
  declarations: [AnimeDetailPage]
})
export class AnimeDetailPageModule {}
