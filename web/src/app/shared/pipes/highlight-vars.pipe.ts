import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Highlights unresolved {{variable}} tokens left in a string after resolution.
 *
 * The input is HTML-escaped before injection, so the only HTML tags in the
 * output are the `<mark>` wrappers we add ourselves — safe to use with
 * bypassSecurityTrustHtml.
 *
 * Usage in a template (requires [innerHTML]):
 *   <span [innerHTML]="someString | highlightVars"></span>
 */
@Pipe({ name: 'highlightVars', pure: true, standalone: true })
export class HighlightVarsPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  /** Matches the same pattern as variable-resolver's PLACEHOLDER, allowing $ prefix. */
  private static readonly UNRESOLVED = /\{\{\s*\$?[\w.-]+\s*\}\}/g;

  transform(text: string): SafeHtml {
    // Escape HTML first so user content can't inject tags.
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Wrap any remaining {{...}} tokens in a styled mark.
    const highlighted = escaped.replace(
      HighlightVarsPipe.UNRESOLVED,
      match => `<mark class="unresolved-var">${match}</mark>`,
    );

    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
