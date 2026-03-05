import { Injectable } from '@angular/core';
import { EnvironmentModel } from '../../shared/models/environment.model';
import { ApiRequest } from '../../shared/models/api-request.model';
import {
  VariableMap,
  ResolvedRequest,
  buildEnvMap,
  buildVarMap,
  mergeVars,
  resolveRequest,
  resolveString,
  findUnresolvedVars,
} from './variable-resolver';
import { buildDynamicVarMap, DYNAMIC_VAR_NAMES, DynamicVarName } from './dynamic-vars';

// Re-export so callers only need to import from this service.
export type { VariableMap, ResolvedRequest, DynamicVarName };
export { buildVarMap, DYNAMIC_VAR_NAMES };

/**
 * Angular service that exposes variable resolution with an ergonomic API.
 *
 * Resolution precedence (lowest → highest):
 *   active environment  →  request-level overrides
 *
 * The service is stateless — it does not hold the active environment itself.
 * Callers obtain the current VariableMap from EnvironmentsService and pass it
 * in, keeping concerns cleanly separated.
 *
 * @example
 *   // In a component or orchestration service:
 *   const envMap  = this.envService.activeVarMap();
 *   const ready   = this.resolver.resolveForExecution(request, envMap);
 *   this.runner.execute(ready).subscribe(…);
 *
 *   // With request-level overrides (future use):
 *   const ready = this.resolver.resolveForExecution(request, envMap, requestVars);
 */
@Injectable({ providedIn: 'root' })
export class VariableResolverService {

  /**
   * Build a flat VariableMap from an environment's enabled variables.
   * Disabled variables and blank keys are excluded.
   * Returns an empty map for null / undefined.
   */
  buildEnvMap(env: EnvironmentModel | null | undefined): VariableMap {
    return buildEnvMap(env);
  }

  /**
   * Produce a variable-resolved clone of a request ready for HTTP execution.
   *
   * Variable sources are merged left-to-right; later sources win on collision.
   * The original request is never mutated.
   *
   * @param request     The request as authored by the user.
   * @param varSources  One or more VariableMaps in ascending precedence order.
   *                    Typically: resolveForExecution(req, envMap, requestOverrides?)
   */
  resolveForExecution(request: ApiRequest, ...varSources: VariableMap[]): ResolvedRequest {
    // Dynamic vars are lowest priority — any user-defined var with the same name wins.
    return resolveRequest(request, mergeVars(buildDynamicVarMap(), ...varSources));
  }

  /**
   * Resolve a single string against the merged variable sources.
   * Use this for live "resolved value" previews in the UI.
   *
   * @example
   *   resolvePreview('{{baseUrl}}/users', envMap)  // → 'https://api.acme.com/users'
   */
  resolvePreview(input: string, ...varSources: VariableMap[]): string {
    return resolveString(input, mergeVars(...varSources));
  }

  /**
   * Return the names of all {{variable}} references in the request that
   * cannot be satisfied by the provided variable sources.
   *
   * Use the result to show "undefined variable" warnings before execution.
   *
   * @example
   *   const missing = this.resolver.unresolvedVars(request, envMap);
   *   if (missing.size > 0) showWarning([...missing]);
   */
  unresolvedVars(request: ApiRequest, ...varSources: VariableMap[]): Set<string> {
    // Include dynamic vars so $-prefixed placeholders are never flagged as unresolved.
    return findUnresolvedVars(request, mergeVars(buildDynamicVarMap(), ...varSources));
  }
}
