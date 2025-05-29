import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SeasonPageRoutingModule } from './season-routing.module';

import { SeasonPage } from './season.page';
import { SharedModule } from '../../shared/shared.module';

import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SeasonPageRoutingModule,
    SharedModule,
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
