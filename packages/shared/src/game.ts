export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerPosition = "top" | "right" | "bottom" | "left";

export type Team = "top_bottom" | "right_left";

export type TablePhase =
  | "WAITING_FOR_PLAYERS" // Lobby : en attente de 4 joueurs
  | "READY_TO_START" // 4 joueurs présents, en attente du lancement
  | "BIDDING" // Phase d'enchères (choix de l'atout)
  | "PLAYING" // Partie en cours
  | "ROUND_END" // Fin de manche, comptage des points
  | "GAME_END" // Fin de partie (score atteint)
  | "PAUSED"; // Joueur déconnecté

export interface Player {
  id: string;
  position: PlayerPosition | null;
  status: "connected" | "disconnected";
  disconnectedAt?: number;
  hand: Card[] | null;
  isReadyToStart: boolean;
}

export type BidValue =
  | 80
  | 90
  | 100
  | 110
  | 120
  | 130
  | 140
  | 150
  | 160
  | "capot"
  | "generale";

export interface Bid {
  playerId: string;
  position: PlayerPosition;
  value: BidValue | "pass";
  suit?: Suit; // L'atout proposé (si pas "pass")
  timestamp: number;
}

export interface BiddingState {
  bids: Bid[];
  currentBidder: PlayerPosition;
  highestBid: Bid | null;
  consecutivePasses: number; // 3 passes consécutifs = fin des enchères
  // Carte retournée (en belote classique, on retourne une carte)
  turnedCard?: Card;
}

export interface Trick {
  cards: {
    position: PlayerPosition;
    card: Card;
    playedAt: number;
  }[];
  leadPosition: PlayerPosition; // Qui a ouvert le pli
  winnerPosition?: PlayerPosition; // Déterminé quand le pli est complet
  winnerTeam?: Team;
}

// =============================================================================
// MANCHE (ROUND) - 8 plis
// =============================================================================

export interface RoundState {
  roundNumber: number;

  // Atout de la manche
  trump: Suit;
  trumpTaker: PlayerPosition; // Qui a pris
  trumpTakerTeam: Team;
  contract: BidValue; // Valeur du contrat

  // Pli en cours
  currentTrick: Trick;
  trickNumber: number; // 1 à 8

  // Historique des plis de cette manche
  completedTricks: Trick[];

  // Points accumulés dans la manche
  trickPoints: {
    top_bottom: number;
    right_left: number;
  };

  // Annonces déclarées (belote, rebelote, carrés, etc.)
  declarations: Declaration[];
}

export interface Declaration {
  type: "belote" | "rebelote" | "tierce" | "cinquante" | "cent" | "carre";
  playerId: string;
  team: Team;
  points: number;
}

// =============================================================================
// TIMER / TOUR DE JEU
// =============================================================================

export interface TurnState {
  currentPlayer: PlayerPosition;
  turnStartedAt: number; // Timestamp début du tour
  turnExpiresAt: number; // Timestamp fin du tour
  turnDuration: number; // Durée configurée (ex: 30000ms)

  // Actions légales pour le joueur actuel (pré-calculées par le serveur)
  legalActions: LegalAction[];
}

export type LegalAction =
  | { type: "play_card"; card: Card }
  | { type: "bid"; value: BidValue; suit: Suit }
  | { type: "pass" }
  | { type: "declare"; declaration: Declaration["type"] };

// =============================================================================
// SCORES
// =============================================================================

export interface GameScore {
  // Score total de la partie
  total: {
    top_bottom: number;
    right_left: number;
  };

  // Historique par manche
  rounds: RoundScore[];

  // Configuration
  targetScore: number; // Score pour gagner (ex: 1000)
}

export interface RoundScore {
  roundNumber: number;
  contract: BidValue;
  trumpTakerTeam: Team;

  // Points de base (plis)
  trickPoints: { top_bottom: number; right_left: number };

  // Points de déclarations
  declarationPoints: { top_bottom: number; right_left: number };

  // Points finaux après règles (dedans, capot, etc.)
  finalPoints: { top_bottom: number; right_left: number };

  // Le preneur a-t-il réussi son contrat ?
  contractMade: boolean;

  // Cas spéciaux
  isDedans: boolean; // Preneur n'a pas fait son contrat
  isCapot: boolean; // Une équipe a fait tous les plis
}

// =============================================================================
// CONFIGURATION DE LA TABLE
// =============================================================================

export interface TableConfig {
  variant: "classique" | "coinche" | "contrée"; //Variante de belote
  turnTimeout: number; // Temps par tour (ms)
  bidTimeout: number; // Temps par enchère (ms)
  disconnectGrace: number; // Grace period déconnexion (ms)
  targetScore: number; // Score pour gagner
  isPrivate: boolean; // Si la table est privée
  password?: string; // Mot de passe si la table est privée
}

// =============================================================================
// ÉTAT COMPLET DE LA TABLE
// =============================================================================

export interface InstanceState {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  config: TableConfig;
  phase: TablePhase;
  players: Player[]; // playerId -> Player
  chat: ChatMessage[];
}

// =============================================================================
// API TYPES
// =============================================================================

export interface CreateRoomRequest {
  name: string;
}

export interface CreateRoomResponse {
  id: string;
  name: string;
}

// seats: {
//     top: string | null;   // playerId ou null si vide
//     right: string | null;
//     bottom: string | null;
//     left: string | null;
// };
// teams: {
//     top_bottom: [string, string] | null;  // [playerId, playerId]
//     right_left: [string, string] | null;
// };

// deck: Card[];  // Cartes restantes (pour la donne)

// bidding: BiddingState | null;

// currentRound: RoundState | null;

// turn: TurnState | null;

// score: GameScore;

// actionLog: GameAction[]; // historic for replay/debug

// =============================================================================
// ACTIONS (pour l'historique et la communication)
// =============================================================================

export type GameAction =
  | { type: "PLAYER_JOIN"; playerId: string; timestamp: number }
  | {
      type: "PLAYER_SIT";
      playerId: string;
      position: PlayerPosition;
      timestamp: number;
    }
  | { type: "PLAYER_READY"; playerId: string; timestamp: number }
  | { type: "GAME_START"; timestamp: number }
  | { type: "CARDS_DEALT"; timestamp: number }
  | { type: "BID"; playerId: string; bid: Bid; timestamp: number }
  | { type: "PLAY_CARD"; playerId: string; card: Card; timestamp: number }
  | {
      type: "TRICK_WON";
      winnerPosition: PlayerPosition;
      points: number;
      timestamp: number;
    }
  | { type: "ROUND_END"; score: RoundScore; timestamp: number }
  | {
      type: "GAME_END";
      winnerTeam: Team;
      finalScore: GameScore["total"];
      timestamp: number;
    }
  | { type: "PLAYER_DISCONNECT"; playerId: string; timestamp: number }
  | { type: "PLAYER_RECONNECT"; playerId: string; timestamp: number }
  | {
      type: "TIMEOUT";
      playerId: string;
      autoAction: LegalAction;
      timestamp: number;
    };

export interface ChatMessage {
  id: string;
  playerId: string;
  message: string;
  timestamp: number;
}

// =============================================================================
// VUE PUBLIQUE vs VUE PRIVÉE
// =============================================================================

// Ce que le serveur envoie à un joueur spécifique
export interface PlayerView {
  table: Omit<InstanceState, "deck" | "players"> & {
    // Joueurs sans leurs mains
    players: Map<string, Omit<Player, "hand"> & { cardCount: number }>;
  };
  // Sa propre main
  myHand: Card[];
  // Ses actions légales
  myLegalActions: LegalAction[];
}
