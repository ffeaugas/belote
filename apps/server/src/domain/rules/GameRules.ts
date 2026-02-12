import type { Card, Player, TablePhase, Suit, BidValue, PlayerPosition } from "@belote/shared";

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
        const readyCount = players.filter(p => p.isReadyToStart).length;
        if (readyCount < 4) {
            return { valid: false, reason: `Need 4 ready players, got ${readyCount}` };
        }
        return { valid: true };
    },

    canPlayCard(
        hand: Card[],
        card: Card,
        currentTrick: Card[],
        trump: Suit,
        leadSuit: Suit | null
    ): ValidationResult {
        // Mock: Allow any card from hand for now
        const hasCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);
        if (!hasCard) {
            return { valid: false, reason: "Card not in hand" };
        }
        // TODO: Implement real belote rules (must follow suit, must trump, etc.)
        return { valid: true };
    },

    canBid(
        currentPhase: TablePhase,
        currentBidder: PlayerPosition,
        playerPosition: PlayerPosition,
        bidValue: BidValue | 'pass',
        highestBid: BidValue | null
    ): ValidationResult {
        if (currentPhase !== 'BIDDING') {
            return { valid: false, reason: "Not in bidding phase" };
        }
        if (currentBidder !== playerPosition) {
            return { valid: false, reason: "Not your turn to bid" };
        }
        if (bidValue !== 'pass' && highestBid !== null) {
            // TODO: Compare bid values properly
        }
        return { valid: true };
    },

    isRoundComplete(trickNumber: number): boolean {
        return trickNumber >= 8;
    },

    isGameComplete(teamScore: number, targetScore: number): boolean {
        return teamScore >= targetScore;
    },

    determineTrickWinner(
        trick: { position: PlayerPosition; card: Card }[],
        trump: Suit,
        leadSuit: Suit
    ): PlayerPosition {
        // Mock: First player wins for now
        // TODO: Implement real trick resolution
        return trick[0].position;
    },

    calculateTrickPoints(cards: Card[], trump: Suit): number {
        // Mock: Return 10 points per trick
        // TODO: Implement real point calculation
        return 10;
    },

    getNextPlayer(current: PlayerPosition): PlayerPosition {
        const order: PlayerPosition[] = ['bottom', 'right', 'top', 'left'];
        const idx = order.indexOf(current);
        return order[(idx + 1) % 4];
    },

    getTeamForPosition(position: PlayerPosition): 'top_bottom' | 'right_left' {
        return position === 'top' || position === 'bottom' ? 'top_bottom' : 'right_left';
    }
};
