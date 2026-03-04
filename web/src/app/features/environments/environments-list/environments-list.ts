import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { EnvironmentsService } from '../../../core/state/environments';
import {
  EnvironmentEditor,
  EnvironmentEditorData,
} from '../environment-editor/environment-editor';
import { EnvironmentModel } from '../../../shared/models/environment.model';

@Component({
  selector: 'app-environments-list',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './environments-list.html',
  styleUrl: './environments-list.scss',
})
export class EnvironmentsList {
  private readonly dialog = inject(MatDialog);
  readonly envService = inject(EnvironmentsService);

  openNew(): void {
    this.openEditor(null);
  }

  openEdit(env: EnvironmentModel, event: MouseEvent): void {
    event.stopPropagation();
    this.openEditor(env);
  }

  delete(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.envService.remove(id);
  }

  select(id: string): void {
    const current = this.envService.activeId();
    this.envService.setActive(current === id ? null : id);
  }

  private openEditor(env: EnvironmentModel | null): void {
    const ref = this.dialog.open<
      EnvironmentEditor,
      EnvironmentEditorData,
      EnvironmentModel
    >(EnvironmentEditor, {
      data: { environment: env },
      width: '640px',
      maxHeight: '80vh',
    });

    ref.afterClosed().subscribe(result => {
      if (result) this.envService.upsert(result);
    });
  }
}
