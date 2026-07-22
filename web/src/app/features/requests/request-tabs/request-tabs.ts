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
    const tab = this.tabsService.tabs().find(t => t.id === id);
    if (tab?.isDirty && !confirmDiscard(`"${tab.label}" has unsaved changes.`)) return;
    this.tabsService.closeTab(id);
  }

  closeOtherTabs(id: string): void {
    const dirty = this.tabsService.tabs().filter(t => t.id !== id && t.isDirty);
    if (dirty.length > 0) {
      const names = dirty.map(t => `• ${t.label}`).join('\n');
      if (!confirmDiscard(`${dirty.length} tab(s) have unsaved changes:\n${names}`)) return;
    }
    this.tabsService.closeOtherTabs(id);
  }

  newTab(): void {
    this.tabsService.newTab();
  }
}

/**
 * Native confirm is deliberate here: it is synchronous, so the caller can bail
 * out inline. A MatDialog would require restructuring these into async flows.
 */
function confirmDiscard(detail: string): boolean {
  return confirm(`${detail}\n\nClose anyway and discard them?`);
}
