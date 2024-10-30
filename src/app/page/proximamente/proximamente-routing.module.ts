import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProximamentePage } from './proximamente.page';

const routes: Routes = [
  {
    path: '',
    component: ProximamentePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProximamentePageRoutingModule {}
