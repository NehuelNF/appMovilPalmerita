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
  lastUpdated: string | null = null;
  newsSource: string = 'Servidor';
  isSourceDown = false;
  private destroy$ = new Subject<void>();

  constructor(
    private kudasaiService: KudasaiService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.subscribeToServiceState();
    this.cargarNoticias();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToServiceState() {
    this.kudasaiService.noticias$
      .pipe(takeUntil(this.destroy$))
      .subscribe(noticias => {
        if (noticias.length > 0) {
          this.noticias = noticias;
        }
      });

    this.kudasaiService.lastUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(updated => {
        this.lastUpdated = updated;
      });

    this.kudasaiService.source$
      .pipe(takeUntil(this.destroy$))
      .subscribe(src => {
        this.newsSource = src;
      });

    this.kudasaiService.isSourceDown$
      .pipe(takeUntil(this.destroy$))
      .subscribe(down => {
        this.isSourceDown = down;
      });
  }

  cargarNoticias() {
    this.isLoading = true;
    this.error = null;

    this.kudasaiService.obtenerNoticias().subscribe({
      next: (noticias) => {
        this.noticias = noticias;
        this.isLoading = false;
        this.error = null;
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.error || err.message || 'Error al conectar con el servidor de noticias.';
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
      message: 'Actualizando noticias desde Somos Kudasai...'
    });
    await loading.present();

    this.kudasaiService.obtenerNoticias(true).subscribe({
      next: (noticias) => {
        this.noticias = noticias;
        this.isLoading = false;
        this.error = null;
        loading.dismiss();
        this.showSuccessToast('¡Noticias actualizadas con éxito!');
      },
      error: (err) => {
        this.isLoading = false;
        loading.dismiss();
        const msg = err?.error?.error || err.message || 'No se pudo actualizar.';
        this.showErrorToast(msg);
      }
    });
  }

  abrirNoticia(url: string) {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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
