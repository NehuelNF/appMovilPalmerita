import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SeasonPageRoutingModule } from './season-routing.module';

import { SeasonPage } from './season.page';

import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SeasonPageRoutingModule,
    RouterModule.forChild([
      {
        path: '',
        component: SeasonPage
      }
    ])
  ],
  declarations: [SeasonPage]
})
export class SeasonPageModule {}
