import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabPage } from './tab.page';

const routes: Routes = [
  {
    path: '',
    component: TabPage,
    children: [
      {
        path: 'home',
        redirectTo: './../../page/home/home.module',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadChildren: () => import('./../../page/home/home.module').then( m => m.HomePageModule)
      },
      {
        path: 'season',
        loadChildren: () => import('./../season/season.module').then( m => m.SeasonPageModule)
      },
    ]
  }
  
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabPageRoutingModule {}