import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SeasonPage } from './season.page';

const routes: Routes = [
  {
    path: '',
    component: SeasonPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SeasonPageRoutingModule {}
