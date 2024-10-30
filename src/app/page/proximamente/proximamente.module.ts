import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProximamentePageRoutingModule } from './proximamente-routing.module';

import { ProximamentePage } from './proximamente.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProximamentePageRoutingModule
  ],
  declarations: [ProximamentePage]
})
export class ProximamentePageModule {}
