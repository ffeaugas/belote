import type { Player } from "@belote/shared";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Domain layer: Pure game rules with no external dependencies.
 * All methods are stateless and only depend on the provided state.
 */
export const GameRules = {
  canStartGame(players: Player[]): ValidationResult {
    const readyCount = players.filter((p) => p.isReadyToStart).length;
    if (readyCount < 4) {
      return {
        valid: false,
        reason: `Need 4 ready players, got ${readyCount}`,
      };
    }
    return { valid: true };
  },
};
