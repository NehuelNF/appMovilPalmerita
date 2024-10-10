import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VtuberPageRoutingModule } from './vtuber-routing.module';

import { VtuberPage } from './vtuber.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VtuberPageRoutingModule
  ],
  declarations: [VtuberPage]
})
export class VtuberPageModule {}
