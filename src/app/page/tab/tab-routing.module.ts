import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabPage } from './tab.page';

const routes: Routes = [
  {
    path: '',
    component: TabPage,
    children: [
      {
        path: '',
        redirectTo: 'home',
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
      {
        path: 'proximamente',
        loadChildren: () => import('./../proximamente/proximamente.module').then( m => m.ProximamentePageModule)
      },
      {
        path: 'perfil',
        loadChildren: () => import('../../page/perfil/perfil.module').then( m => m.PerfilPageModule)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabPageRoutingModule {}