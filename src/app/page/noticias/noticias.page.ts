import { Component, OnInit, OnDestroy } from '@angular/core';
import { KudasaiService, Noticia } from '../../../managers/KudasaiService';
import { ToastController, LoadingController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-noticias',
  templateUrl: './noticias.page.html',
  styleUrls: ['./noticias.page.scss'],
})
export class NoticiasPage implements OnInit, OnDestroy {
  noticias: Noticia[] = [];
  isLoading = true;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private kudasaiService: KudasaiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.cargarNoticias();
    this.subscribeToNoticiasUpdates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToNoticiasUpdates() {
    this.kudasaiService.noticias$
      .pipe(takeUntil(this.destroy$))
      .subscribe(noticias => {
        if (noticias.length > 0) {
          this.noticias = noticias;
        }
      });
  }

  cargarNoticias() {
    this.isLoading = true;
    this.error = null;

    this.kudasaiService.obtenerNoticias().subscribe({
      next: (noticias) => {
        this.noticias = noticias;
        this.isLoading = false;
      },
      error: (error) => {
        this.error = error.message || 'Error al cargar noticias';
        this.isLoading = false;
        if (this.error) {
          this.showErrorToast(this.error);
        }
      }
    });
  }

  async handleRefresh(event: any) {
    try {
      await this.forceRefresh();
    } finally {
      event.target.complete();
    }
  }

  async forceRefresh() {
    const loading = await this.loadingCtrl.create({
      message: 'Actualizando noticias...'
    });
    await loading.present();

    try {
      this.kudasaiService.refreshNoticias();
      await this.showSuccessToast('¡Noticias actualizadas!');
    } catch (error: any) {
      await this.showErrorToast('Error al actualizar: ' + error.message);
    } finally {
      await loading.dismiss();
    }
  }

  abrirNoticia(url: string) {
    window.open(url, '_blank');
  }

  private async showErrorToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }

  private async showSuccessToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
  }
}
