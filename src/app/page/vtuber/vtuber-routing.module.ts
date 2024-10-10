import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { VtuberPage } from './vtuber.page';

const routes: Routes = [
  {
    path: '',
    component: VtuberPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VtuberPageRoutingModule {}
