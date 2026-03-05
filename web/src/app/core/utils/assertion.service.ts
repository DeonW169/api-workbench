import { Injectable } from '@angular/core';
import {
  Assertion,
  AssertionResult,
  AssertionSummary,
} from '../../shared/models/assertion.model';
import { ApiResponse } from '../../shared/models/api-response.model';
import { evaluateJsonPath } from './json-path';

@Injectable({ providedIn: 'root' })
export class AssertionService {
  /**
   * Evaluate all enabled assertions against a response.
   * Disabled assertions are skipped and do not appear in the summary.
   */
  evaluate(assertions: Assertion[], response: ApiResponse): AssertionSummary {
    const results = assertions
      .filter(a => a.enabled)
      .map(a => this.evaluateOne(a, response));

    return {
      results,
      passed: results.filter(r => r.passed).length,
      failed:  results.filter(r => !r.passed).length,
      total:   results.length,
    };
  }

  // ── Per-type evaluators ────────────────────────────────────────────────────

  private evaluateOne(assertion: Assertion, response: ApiResponse): AssertionResult {
    switch (assertion.type) {
      case 'statusEquals':   return this.checkStatus(assertion, response);
      case 'bodyContains':   return this.checkBodyContains(assertion, response);
      case 'headerExists':   return this.checkHeaderExists(assertion, response);
      case 'jsonPathExists': return this.checkJsonPathExists(assertion, response);
      case 'jsonPathEquals': return this.checkJsonPathEquals(assertion, response);
    }
  }

  private checkStatus(
    a: Extract<Assertion, { type: 'statusEquals' }>,
    response: ApiResponse,
  ): AssertionResult {
    const passed = response.status === a.expected;
    return {
      assertion: a,
      passed,
      actual: response.status,
      message: passed
        ? `Status is ${response.status}`
        : `Expected status ${a.expected}, got ${response.status}`,
    };
  }

  private checkBodyContains(
    a: Extract<Assertion, { type: 'bodyContains' }>,
    response: ApiResponse,
  ): AssertionResult {
    const bodyStr = bodyAsString(response.body);
    const passed = bodyStr.includes(a.substring);
    return {
      assertion: a,
      passed,
      message: passed
        ? `Body contains "${a.substring}"`
        : `Body does not contain "${a.substring}"`,
    };
  }

  private checkHeaderExists(
    a: Extract<Assertion, { type: 'headerExists' }>,
    response: ApiResponse,
  ): AssertionResult {
    const key = a.header.toLowerCase();
    const found = Object.keys(response.headers).some(k => k.toLowerCase() === key);
    return {
      assertion: a,
      passed: found,
      message: found
        ? `Header "${a.header}" exists`
        : `Header "${a.header}" not found`,
    };
  }

  private checkJsonPathExists(
    a: Extract<Assertion, { type: 'jsonPathExists' }>,
    response: ApiResponse,
  ): AssertionResult {
    const { found, value } = evaluateJsonPath(response.body, a.path);
    return {
      assertion: a,
      passed: found,
      actual: value,
      message: found
        ? `${a.path} exists`
        : `${a.path} does not exist`,
    };
  }

  private checkJsonPathEquals(
    a: Extract<Assertion, { type: 'jsonPathEquals' }>,
    response: ApiResponse,
  ): AssertionResult {
    const { found, value } = evaluateJsonPath(response.body, a.path);
    if (!found) {
      return {
        assertion: a,
        passed: false,
        message: `${a.path} does not exist`,
      };
    }
    // Compare as strings so "42" matches the number 42.
    const actual = String(value);
    const passed = actual === a.expected;
    return {
      assertion: a,
      passed,
      actual: value,
      message: passed
        ? `${a.path} equals "${a.expected}"`
        : `${a.path}: expected "${a.expected}", got "${actual}"`,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Coerce a response body to a searchable string. */
function bodyAsString(body: unknown): string {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body) ?? '';
  } catch {
    return '';
  }
}
