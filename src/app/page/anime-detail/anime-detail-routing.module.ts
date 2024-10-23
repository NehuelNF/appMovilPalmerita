import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AnimeDetailPage } from './anime-detail.page';

const routes: Routes = [
  {
    path: '',
    component: AnimeDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnimeDetailPageRoutingModule {}
