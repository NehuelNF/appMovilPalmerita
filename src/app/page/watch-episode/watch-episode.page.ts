import { Component, OnDestroy, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom, Subscription } from 'rxjs';
import { AnimeService } from '../../../managers/AnimeService';

interface Player { name: string; url: string; type?: 'direct' | 'iframe'; }
@Component({selector:'app-watch-episode',templateUrl:'./watch-episode.page.html',styleUrls:['./watch-episode.page.scss']})
export class WatchEpisodePage implements OnInit, OnDestroy {
  animeId=''; episodeNumber=1; animeTitle=''; episodeTitle=''; episodeThumbnail='';
  anime:any=null; totalEpisodes=0; episodes:{number:number;title:string}[]=[];
  safeIframeUrl:SafeResourceUrl|null=null;
  streamingError=''; loading=true; players:Player[]=[]; selectedPlayer=''; sourceUrl='';
  directVideoUrl='';
  showAllEpisodes=false;
  @ViewChild('playerSurface') playerSurface?:ElementRef<HTMLElement>;
  expanded=false;
  fullscreenMessage='';
  async toggleFullscreen() {
    const element=this.playerSurface?.nativeElement;
    if(!element) return;
    if(document.fullscreenElement===element) { await document.exitFullscreen(); return; }
    if(this.expanded) { this.expanded=false; this.fullscreenMessage=''; return; }
    try {
      if(!document.fullscreenEnabled || !element.requestFullscreen) throw new Error('Unavailable');
      await element.requestFullscreen();
    } catch {
      this.expanded=true;
      this.fullscreenMessage='Vista ampliada: este navegador no permite pantalla completa. Pulsa Salir o Escape para volver.';
    }
  }
  @HostListener('document:keydown.escape') closeExpanded() { this.expanded=false; this.fullscreenMessage=''; }
  private generation=0;
  private subscription=new Subscription();
  constructor(private route:ActivatedRoute,private router:Router,private animeService:AnimeService,private http:HttpClient,private sanitizer:DomSanitizer) {}
  ngOnInit() {
    this.subscription=this.route.params.subscribe(params=>{
      this.animeId=params['animeId']; this.episodeNumber=Number(params['episodeNumber']);
      void this.loadEpisode();
    });
  }
  async loadEpisode(useEnglish=false) {
    const generation=++this.generation;
    const animeId=this.animeId, episode=this.episodeNumber;
    this.safeIframeUrl=null; this.directVideoUrl=''; this.players=[]; this.streamingError=''; this.loading=true; this.sourceUrl='';
    this.episodeTitle='Episodio '+episode;
    try {
      if(!this.anime || this.anime.mal_id!==Number(animeId)) {
        const response:any=await firstValueFrom(this.animeService.getAnimeById(Number(animeId)));
        if(generation!==this.generation) return;
        this.anime=response.data || response;
      }
      this.animeTitle=this.anime.title || '';
      this.totalEpisodes=this.anime.episodes || 0;
      this.episodes=Array.from({length:this.totalEpisodes},(_,i)=>({number:i+1,title:'Episodio '+(i+1)}));
      this.episodeThumbnail=this.anime.images?.jpg?.large_image_url || 'assets/icon/favicon.png';
      const title=useEnglish ? this.anime.title_english : this.animeTitle;
      const slug=(title || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/[\s-]+/g,'-');
      this.sourceUrl='https://animeav1.com/media/'+slug+'/'+episode;
      const result=await firstValueFrom(this.http.get<{players:Player[];sourceUrl:string}>('/api/player',{params:{slug,episode:String(episode)}}));
      if(generation!==this.generation) return;
      this.players=result.players;
      this.sourceUrl=result.sourceUrl;
      if(!this.players.length) throw new Error('Sin reproductores disponibles.');
      this.selectPlayer(this.players.find(player => player.type !== 'direct' && /^(www\.)?mp4upload\.com$/i.test(new URL(player.url).hostname)) || this.players[0]);
    } catch(error:any) {
      if(generation!==this.generation) return;
      this.streamingError=error?.error?.error || 'No se pudo obtener el reproductor del capítulo.';
    } finally {if(generation===this.generation) this.loading=false;}
  }
  selectPlayer(player:Player) {
    const url=new URL(player.url);
    if(player.type==='direct') {
      if(url.protocol!=='https:' || !/(^|\.)mp4upload\.com$/i.test(url.hostname) || url.username || url.password) return;
      this.selectedPlayer=player.url; this.streamingError=''; this.safeIframeUrl=null; this.directVideoUrl=player.url; return;
    }
    const hosts=['player.zilla-networks.com','animeav1.uns.bio','voe.sx','mega.nz','www.mp4upload.com','mp4upload.com'];
    if(url.protocol!=='https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port) return;
    this.selectedPlayer=player.url; this.streamingError=''; this.directVideoUrl='';
    this.safeIframeUrl=this.sanitizer.bypassSecurityTrustResourceUrl(player.url);
  }
  onIframeLoad() { /* A loaded cross-origin frame does not confirm playback. */ }
  onIframeError(event:Event) { this.streamingError='Este servidor no pudo abrirse. Prueba otro servidor o abre el capítulo en su página de origen.'; }
  hasEnglishTitle(){return !!this.anime?.title_english && this.anime.title_english!==this.animeTitle;}
  tryEnglishTitle(){void this.loadEpisode(true);}
  reloadCurrentEpisode(){void this.loadEpisode();}
  hasPreviousEpisode(){return this.episodeNumber>1;}
  hasNextEpisode(){return this.episodeNumber<this.totalEpisodes;}
  goToPreviousEpisode(){if(this.hasPreviousEpisode()) this.selectEpisode(this.episodeNumber-1);}
  goToNextEpisode(){if(this.hasNextEpisode()) this.selectEpisode(this.episodeNumber+1);}
  selectEpisode(number:number){this.safeIframeUrl=null;this.router.navigate(['/watch',this.animeId,number]);}
  getEpisodeThumbnail(episode:any){return episode.thumbnail || this.episodeThumbnail;}
  openExternalLink(url:string){if(url.startsWith('https://animeav1.com/')) window.open(url,'_blank','noopener,noreferrer');}
  goBack(){this.safeIframeUrl=null;this.router.navigate(['/anime',this.animeId]);}
  ionViewWillLeave(){++this.generation;this.safeIframeUrl=null;this.closeExpanded();if(document.fullscreenElement===this.playerSurface?.nativeElement) void document.exitFullscreen();}
  ngOnDestroy(){++this.generation;this.safeIframeUrl=null;this.subscription.unsubscribe();}
}
