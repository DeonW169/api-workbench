import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

// ── Search helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the key, the value itself, or any descendant in the subtree
 * contains the search term (case-insensitive).
 */
function subtreeMatches(key: string | null, value: unknown, term: string): boolean {
  const lc = term.toLowerCase();
  if (key !== null && key.toLowerCase().includes(lc)) return true;
  if (value === null || value === undefined) return 'null'.includes(lc);
  if (typeof value === 'string') return value.toLowerCase().includes(lc);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value).includes(lc);
  if (Array.isArray(value))
    return value.some((v, i) => subtreeMatches(String(i), v, term));
  if (typeof value === 'object')
    return Object.entries(value as Record<string, unknown>)
      .some(([k, v]) => subtreeMatches(k, v, term));
  return false;
}

/**
 * Returns true if any DIRECT OR INDIRECT DESCENDANT of value matches the term,
 * without checking the container's own key or type.
 */
function descendantMatches(value: unknown, term: string): boolean {
  if (Array.isArray(value))
    return value.some((v, i) => subtreeMatches(String(i), v, term));
  if (value !== null && typeof value === 'object')
    return Object.entries(value as Record<string, unknown>)
      .some(([k, v]) => subtreeMatches(k, v, term));
  return false;
}

type NodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/**
 * Recursive JSON tree node.
 * Imports itself (self-reference) to enable recursive child rendering.
 */
@Component({
  selector: 'app-json-tree',
  // eslint-disable-next-line @angular-eslint/no-forward-ref
  imports: [MatIconModule, JsonTree],
  templateUrl: './json-tree.html',
  styleUrl: './json-tree.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JsonTree {
  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** Property name (object key). Null at the root level. */
  readonly nodeKey = input<string | null>(null);

  readonly value = input.required<unknown>();

  /** True when this node is the last sibling — suppresses trailing comma. */
  readonly isLastChild = input(true);

  /**
   * True when this node is a direct child of an array.
   * Displays the index as a plain number instead of a quoted key name.
   */
  readonly isArrayItem = input(false);

  readonly searchTerm = input('');

  /** Increment to force-expand all nodes. */
  readonly expandGen = input(0);

  /** Increment to force-collapse all nodes. */
  readonly collapseGen = input(0);

  // ── Local state ─────────────────────────────────────────────────────────────

  readonly isOpen = signal(true);

  // ── Derived ─────────────────────────────────────────────────────────────────

  readonly type = computed<NodeType>(() => {
    const v = this.value();
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'object') return 'object';
    return typeof v as 'string' | 'number' | 'boolean';
  });

  readonly isContainer = computed(() =>
    this.type() === 'object' || this.type() === 'array',
  );

  readonly entries = computed<{ key: string; val: unknown }[]>(() => {
    const v = this.value();
    if (Array.isArray(v)) return v.map((item, i) => ({ key: String(i), val: item }));
    if (v !== null && typeof v === 'object')
      return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({ key: k, val }));
    return [];
  });

  readonly childCount = computed(() => this.entries().length);

  /** Whether this node (by key/value) or any descendant matches the search term. */
  readonly matchesSearch = computed(() => {
    const term = this.searchTerm().trim();
    return !term || subtreeMatches(this.nodeKey(), this.value(), term);
  });

  /**
   * Effective open state:
   * - When searching: auto-expand containers whose descendants match.
   *   (If only the container's own key matches, keep collapsed for clarity.)
   * - Otherwise: use local isOpen signal.
   */
  readonly effectiveOpen = computed(() => {
    const term = this.searchTerm().trim();
    if (term && this.isContainer()) return descendantMatches(this.value(), term);
    return this.isOpen();
  });

  readonly openBracket  = computed(() => this.type() === 'array' ? '[' : '{');
  readonly closeBracket = computed(() => this.type() === 'array' ? ']' : '}');

  readonly valueClass = computed(() => {
    switch (this.type()) {
      case 'string':  return 'jv-string';
      case 'number':  return 'jv-number';
      case 'boolean': return 'jv-boolean';
      case 'null':    return 'jv-null';
      default:        return '';
    }
  });

  readonly displayValue = computed(() => {
    const v = this.value();
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return `"${v}"`;
    return String(v);
  });

  // ── Global expand / collapse ─────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const gen = this.expandGen();
      if (gen > 0) untracked(() => this.isOpen.set(true));
    });
    effect(() => {
      const gen = this.collapseGen();
      if (gen > 0) untracked(() => this.isOpen.set(false));
    });
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }
}
