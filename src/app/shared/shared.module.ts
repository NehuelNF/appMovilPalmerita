import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SkeletonLoaderComponent } from '../components/skeleton-loader/skeleton-loader.component';

@NgModule({
  declarations: [
    SkeletonLoaderComponent
  ],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [
    SkeletonLoaderComponent
  ]
})
export class SharedModule { }