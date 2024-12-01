import { Component, OnInit } from '@angular/core';
import { UserGetUseCase } from 'src/app/use-cases/user-get.use-case';
import { UserLogoutUseCase } from 'src/app/use-cases/user-logout.use-case';
import { UserUpdateUseCase } from 'src/app/use-cases/user-update.use-case';
import { UserDeleteUseCase } from 'src/app/use-cases/user-delete.use-case';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ActionSheetService } from 'src/managers/ActionSheetService';
import { UpdateAvatarUseCase } from 'src/app/use-cases/update-avatar.use-case';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage implements OnInit {
  userName: string | null = null;
  newUsername: string = '';
  avatar: string | null = null;

  constructor(
    private userGetUseCase: UserGetUseCase,
    private userLogoutUseCase: UserLogoutUseCase,
    private router: Router,
    private userUpdateUseCase: UserUpdateUseCase,
    private alertController: AlertController,
    private userDeleteUseCase: UserDeleteUseCase,
    private actionSheetService: ActionSheetService,
    private updateAvatarUseCase: UpdateAvatarUseCase
  ) {}

  async ngOnInit() {
    try {
      this.userName = await this.userGetUseCase.getUserName();
      if (!this.userName) {
        this.router.navigate(['/login']);
      }
      const user = await this.userGetUseCase.getUser();
      this.avatar = user?.avatar || null;

      this.updateAvatarUseCase.avatarUpdated$.subscribe(newAvatar => {
        this.avatar = newAvatar;
      });
    } catch (error) {
      console.error('Error al obtener nombre de usuario:', error);
      this.router.navigate(['/login']);
    }
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
      this.userName = null;
    } catch (error) {
      console.error('Error durante el logout:', error);
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
}