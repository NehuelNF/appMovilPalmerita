import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { UserGetUseCase } from 'src/app/use-cases/user-get.use-case';
import { UserLogoutUseCase } from 'src/app/use-cases/user-logout.use-case';
import { UserUpdateUseCase } from 'src/app/use-cases/user-update.use-case';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ActionSheetService } from 'src/managers/ActionSheetService';
import { UpdateAvatarUseCase } from 'src/app/use-cases/update-avatar.use-case';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { UserProfileUseCase } from 'src/app/use-cases/user-profile.use-case';
import { AuthService } from '../../../managers/AuthService'; // Make sure this path is correct
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { FirebaseError } from 'firebase/app';
import { NotificationService } from '../../managers/NotificationService'; // Importar NotificationService
import { UserDeleteUseCase } from 'src/app/use-cases/user-delete.use-case'; // Asegúrate que la ruta es correcta

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit, OnDestroy {
  get darkMode(): boolean { return document.documentElement.classList.contains('ion-palette-dark'); }
  toggleTheme() {
    const next = !this.darkMode;
    document.documentElement.classList.toggle('ion-palette-dark', next);
    document.documentElement.dataset['theme'] = next ? 'dark' : 'light';
    try { localStorage.setItem('palmerita-theme', next ? 'dark' : 'light'); } catch {}
  }
  private subscriptions = new Subscription();
  providerResolved = false;
  savingUsername = false;
  userName: string | null = null;
  newUsername: string = '';
  avatar: string | null = null;
  isGoogleUser: boolean = false;

  constructor(
    private firestore: AngularFirestore,
    private zone: NgZone,
    private userGetUseCase: UserGetUseCase,
    private userLogoutUseCase: UserLogoutUseCase,
    private router: Router,
    private userUpdateUseCase: UserUpdateUseCase,
    private alertController: AlertController,
    private actionSheetService: ActionSheetService,
    private updateAvatarUseCase: UpdateAvatarUseCase,
    private fireAuth: AngularFireAuth,
    private userProfileUseCase: UserProfileUseCase,
    private toastController: ToastController,
    private authService: AuthService,
    private notificationService: NotificationService, // Inyectar NotificationService
    private userDeleteUseCase: UserDeleteUseCase // Inyectar UserDeleteUseCase
  ) {}

  ngOnInit() {
    this.subscriptions.add(this.fireAuth.user.pipe(switchMap(user => {
      this.zone.run(() => {
        this.providerResolved = !!user;
        this.isGoogleUser = !!user?.providerData.some(p => p?.providerId === 'google.com');
      });
      if (!user) {
        void this.router.navigate(['/login']);
        return of(null);
      }
      return this.firestore.collection('users').doc(user.uid).valueChanges();
    })).subscribe({
      next: (profile: any) => this.zone.run(() => {
        this.userName = profile?.username || null;
        this.avatar = profile?.avatar || null;
      }),
      error: () => { void this.showErrorAlert('No se pudo actualizar el perfil. Inténtalo de nuevo.'); }
    }));
    this.subscriptions.add(this.updateAvatarUseCase.avatarUpdated$.subscribe(avatar => {
      this.zone.run(() => { this.avatar = avatar; });
    }));
  }

  ngOnDestroy() { this.subscriptions.unsubscribe(); }

  // Mostrar el actionsheet
  async showActionSheet() {
    await this.actionSheetService.presentActionSheet();
  }

  // Añadir estos métodos para alerts
  private async showSuccessAlert() {
    const alert = await this.alertController.create({
      header: 'Cambio Exitoso',
      message: 'Nombre actualizado correctamente',
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  //Logout
  async onLogoutButtonPressed() {
    try {
      await this.userLogoutUseCase.logoutUser();
      // Limpiar todos los datos del usuario actual
      this.userName = null;
      this.avatar = null;
      this.newUsername = '';
      // Navegar al login
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error durante el logout:', error);
      await this.showErrorAlert('Error al cerrar sesión');
    }
  }

  //Actualizar nombre
  async onUpdateUsername() {
    if (this.savingUsername) return;
    const username = this.newUsername.trim();
    if (!username) return;
    this.savingUsername = true;
    try {
      if (username) {
        await this.userUpdateUseCase.updateUsername(username);
        this.zone.run(() => { this.userName = username; this.newUsername = ''; });
        await this.showSuccessAlert();
      }
    } catch (error: any) {
      console.error('Error al actualizar nombre:', error);
      await this.showErrorAlert(error.message || 'Error al actualizar nombre');
    } finally {
      this.zone.run(() => { this.savingUsername = false; });
    }
  }

  //Eliminar Usuarioo
  async onDeleteAccount() {
    const alert = await this.alertController.create({
      header: '¿Estás seguro?',
      message: 'Esta acción no se puede deshacer',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.userDeleteUseCase.deleteUser(); // Corregido userDeleteUseCase
            } catch (error: any) {
              await this.showErrorAlert('Error al eliminar cuenta: ' + error.message);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async linkWithGoogle() {
    try {
      const currentUser = await this.fireAuth.currentUser;
      if (!currentUser) {
        throw new Error('No hay usuario autenticado');
      }

      // Use Firebase Google provider directly instead of GoogleAuth
      const provider = new firebase.auth.GoogleAuthProvider();
      
      try {
        await currentUser.linkWithPopup(provider);
        this.zone.run(() => { this.isGoogleUser = true; this.providerResolved = true; });
        
        const toast = await this.toastController.create({
          message: 'Cuenta vinculada exitosamente con Google',
          duration: 2000,
          color: 'success'
        });
        toast.present();
        
      } catch (error: any) {
        let errorMessage = 'Error al vincular cuenta con Google';
        
        if (error.code === 'auth/credential-already-in-use') {
          errorMessage = 'Esta cuenta de Google ya está vinculada a otro usuario';
        }

        const toast = await this.toastController.create({
          message: errorMessage,
          duration: 2000,
          color: 'danger'
        });
        toast.present();
      }
    } catch (error) {
      console.error('Error al vincular cuenta:', error);
      const toast = await this.toastController.create({
        message: 'Error: Usuario no autenticado',
        duration: 2000, 
        color: 'danger'
      });
      toast.present();
    }
  }

  // Nuevo método para probar notificaciones
  async testNotifications() {
    console.log('Botón de probar notificaciones presionado');
    await this.notificationService.sendTestNotification();
    const alert = await this.alertController.create({
      header: 'Notificación Enviada',
      message: 'Se ha enviado una notificación de prueba. Deberías recibirla en breve.',
      buttons: ['OK']
    });
    await alert.present();
  }
}
