import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SeasonPageRoutingModule } from './season-routing.module';

import { SeasonPage } from './season.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SeasonPageRoutingModule
  ],
  declarations: [SeasonPage]
})
export class SeasonPageModule {}
