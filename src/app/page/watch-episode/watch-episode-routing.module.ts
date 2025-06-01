import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WatchEpisodePage } from './watch-episode.page';

const routes: Routes = [
  {
    path: '',
    component: WatchEpisodePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WatchEpisodePageRoutingModule {}
