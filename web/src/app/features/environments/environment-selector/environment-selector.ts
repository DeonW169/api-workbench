import { Component, inject } from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { EnvironmentsService } from '../../../core/state/environments';

@Component({
  selector: 'app-environment-selector',
  imports: [MatSelectModule, MatFormFieldModule, MatIconModule],
  templateUrl: './environment-selector.html',
  styleUrl: './environment-selector.scss',
})
export class EnvironmentSelector {
  readonly envService = inject(EnvironmentsService);

  onChange(id: string | null): void {
    this.envService.setActive(id);
  }
}
