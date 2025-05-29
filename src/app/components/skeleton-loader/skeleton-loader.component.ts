import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-skeleton-loader',
  templateUrl: './skeleton-loader.component.html',
  styleUrls: ['./skeleton-loader.component.scss'],
})
export class SkeletonLoaderComponent implements OnInit {
  @Input() type: 'card' | 'text' | 'avatar' | 'image' = 'card';
  @Input() lines: number = 3;
  @Input() animated: boolean = true;

  constructor() {}

  ngOnInit() {}

  getLines(): number[] {
    return Array(this.lines).fill(0).map((_, i) => i);
  }
}
