import type { ChatMessage, Player, TablePhase } from "@belote/shared";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSessionId } from "../lib/utils";

interface RoomState {
  phase: TablePhase;
  playerId: string | null;
  roomId: string | null;
  roomName: string | null;
  players: Player[];
  messages: ChatMessage[];
  isConnected: boolean;
  error: string | null;
}

type ServerMessage =
  | {
      type: "welcome_message";
      playerId: string;
      roomName: string;
      players: Player[];
      chatMessages: ChatMessage[];
    }
  | {
      type: "player_ready_changed";
      playerId: string;
      isReady: boolean;
      players: Player[];
    }
  | { type: "room_state"; playerId: string; roomId: string; players: Player[] }
  | { type: "player_joined"; playerId: string; players: Player[] }
  | { type: "player_left"; playerId: string; players: Player[] }
  | { type: "chat"; content: ChatMessage }
  | { type: "phase_changed"; phase: TablePhase }
  | { type: "error"; message: string }
  | { type: "start_game" };

export function useRoom(roomId: string) {
  const [state, setState] = useState<RoomState>({
    playerId: null,
    roomId: null,
    roomName: null,
    phase: "WAITING_FOR_PLAYERS",
    players: [],
    messages: [],
    isConnected: false,
    error: null,
  });
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const userId = getSessionId();
    ws.current = new WebSocket(
      `ws://localhost:3001/ws/${roomId}?userId=${userId}`,
    );

    ws.current.onopen = () => {
      setState((prev) => ({ ...prev, isConnected: true }));
    };

    ws.current.onmessage = (event) => {
      try {
        const data: ServerMessage = JSON.parse(event.data);

        console.log("Socket Message reçu :", data);

        switch (data.type) {
          case "welcome_message":
            setState((prev) => ({
              ...prev,
              playerId: data.playerId,
              roomId: roomId,
              roomName: data.roomName,
              players: data.players,
              messages: data.chatMessages,
            }));
            break;

          case "room_state":
            setState((prev) => ({
              ...prev,
              playerId: data.playerId,
              roomId: data.roomId,
              players: data.players,
            }));
            break;
          case "player_ready_changed":
          case "player_joined":
          case "player_left":
            setState((prev) => ({
              ...prev,
              players: data.players,
            }));
            break;

          case "chat":
            setState((prev) => ({
              ...prev,
              messages: [...prev.messages, data.content],
            }));
            break;

          case "phase_changed":
            setState((prev) => ({ ...prev, phase: data.phase }));
            break;

          case "error":
            setState((prev) => ({ ...prev, error: data.message }));
            break;
        }
      } catch (e) {
        console.error("Failed to parse message:", event.data);
      }
    };

    ws.current.onclose = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
    };

    return () => {
      ws.current?.close();
    };
  }, [roomId]);

  const sendMessage = useCallback((text: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "chat", text }));
    }
  }, []);

  const togglePlayerReady = useCallback((playerId: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({ type: "toggle_player_ready", playerId }),
      );
    }
  }, []);

  const startGame = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "start_game" }));
    }
  }, []);

  return { ...state, sendMessage, togglePlayerReady, startGame };
}
