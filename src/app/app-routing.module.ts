import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
  path: 'splash',
  loadChildren: () => import('./splash/splash.module').then( m => m.SplashPageModule)
  },
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'register',
    loadChildren: () => import('./register/register.module').then( m => m.RegisterPageModule)
  },
  {
    path: 'tab',
    loadChildren: () => import('./page/tab/tab.module').then( m => m.TabPageModule)
  },
  {
    path: 'anime/:id',
    loadChildren: () => import('./page/anime-detail/anime-detail.module').then(m => m.AnimeDetailPageModule)
  },
  {
    path: 'proximamente',
    loadChildren: () => import('./page/proximamente/proximamente.module').then( m => m.ProximamentePageModule)
  },
  {
    path: 'perfil',
    loadChildren: () => import('./page/perfil/perfil.module').then( m => m.PerfilPageModule)
  },
  {
    path: 'favoritos',
    loadChildren: () => import('./page/favoritos/favoritos.module').then( m => m.FavoritosPageModule)
  },
  {
    path: 'notifications-settings',
    loadChildren: () => import('./page/notifications-settings/notifications-settings.module').then( m => m.NotificationsSettingsPageModule)
  },  {
    path: 'noticias',
    loadChildren: () => import('./page/noticias/noticias.module').then( m => m.NoticiasPageModule)
  }



];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
