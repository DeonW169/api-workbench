import { Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

interface RequestTab {
  id: string;
  label: string;
  method: string;
  dirty: boolean;
}

@Component({
  selector: 'app-request-tabs',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './request-tabs.html',
  styleUrl: './request-tabs.scss',
})
export class RequestTabs {
  activeTabId = signal<string>('tab-1');

  tabs = signal<RequestTab[]>([
    { id: 'tab-1', label: 'New Request', method: 'GET', dirty: false },
  ]);

  setActive(id: string): void {
    this.activeTabId.set(id);
  }

  addTab(): void {
    const id = `tab-${Date.now()}`;
    this.tabs.update(tabs => [
      ...tabs,
      { id, label: 'New Request', method: 'GET', dirty: false },
    ]);
    this.activeTabId.set(id);
  }

  closeTab(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.tabs.update(tabs => tabs.filter(t => t.id !== id));
    if (this.activeTabId() === id) {
      const remaining = this.tabs();
      if (remaining.length) this.activeTabId.set(remaining[remaining.length - 1].id);
    }
  }
}
