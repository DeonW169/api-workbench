import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { TabsService } from '../../../core/state/tabs';

@Component({
  selector: 'app-request-tabs',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, MatMenuModule],
  templateUrl: './request-tabs.html',
  styleUrl: './request-tabs.scss',
})
export class RequestTabs {
  readonly tabsService = inject(TabsService);

  /** Tab id that the context menu is open for. */
  menuTabId = '';

  setActive(id: string): void {
    this.tabsService.activateTab(id);
  }

  closeTab(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.tabsService.closeTab(id);
  }

  closeOtherTabs(id: string): void {
    this.tabsService.closeOtherTabs(id);
  }

  newTab(): void {
    this.tabsService.newTab();
  }
}
