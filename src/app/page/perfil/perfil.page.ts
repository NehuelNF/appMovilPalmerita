import { Component, OnInit } from '@angular/core';
import { UserGetUseCase } from 'src/app/use-cases/user-get.use-case';
import { UserLogoutUseCase } from 'src/app/use-cases/user-logout.use-case';
import { UserUpdateUseCase } from 'src/app/use-cases/user-update.use-case';
import { UserDeleteUseCase } from 'src/app/use-cases/user-delete.use-case';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ActionSheetService } from 'src/managers/ActionSheetService';
import { UpdateAvatarUseCase } from 'src/app/use-cases/update-avatar.use-case';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { UserProfileUseCase } from 'src/app/use-cases/user-profile.use-case';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { AuthService } from '../../../managers/AuthService'; // Make sure this path is correct
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { FirebaseError } from 'firebase/app';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit {
  userName: string | null = null;
  newUsername: string = '';
  avatar: string | null = null;
  isGoogleUser: boolean = false;

  constructor(
    private userGetUseCase: UserGetUseCase,
    private userLogoutUseCase: UserLogoutUseCase,
    private router: Router,
    private userUpdateUseCase: UserUpdateUseCase,
    private alertController: AlertController,
    private userDeleteUseCase: UserDeleteUseCase,
    private actionSheetService: ActionSheetService,
    private updateAvatarUseCase: UpdateAvatarUseCase,
    private fireAuth: AngularFireAuth,
    private userProfileUseCase: UserProfileUseCase,
    private toastController: ToastController,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    try {
      // Obtener datos iniciales
      await this.loadUserData();
      
      // Suscribirse a cambios de autenticación
      this.fireAuth.authState.subscribe(async user => {
        if (user) {
          await this.loadUserData();
        } else {
          this.router.navigate(['/login']);
        }
      });
    } catch (error) {
      console.error('Error al obtener nombre de usuario:', error);
      this.router.navigate(['/login']);
    }
  }

  // Método para cargar los datos del usuario
  private async loadUserData() {
    this.userName = await this.userGetUseCase.getUserName();
    if (!this.userName) {
      this.router.navigate(['/login']);
      return;
    }
    
    const user = await this.userGetUseCase.getUser();
    this.avatar = user?.avatar || null;
  
    // Check if user is authenticated with Google
    const currentUser = await this.fireAuth.currentUser;
    this.isGoogleUser = currentUser?.providerData.some(
      provider => provider?.providerId === 'google.com'
    ) || false;

    this.updateAvatarUseCase.avatarUpdated$.subscribe(newAvatar => {
      this.avatar = newAvatar;
    });
  }

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
    try {
      if (this.newUsername) {
        await this.userUpdateUseCase.updateUsername(this.newUsername);
        this.userName = this.newUsername;
        this.newUsername = '';
        await this.showSuccessAlert();
      }
    } catch (error: any) {
      console.error('Error al actualizar nombre:', error);
      await this.showErrorAlert(error.message || 'Error al actualizar nombre');
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
              await this.userDeleteUseCase.deleteUser();
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
}