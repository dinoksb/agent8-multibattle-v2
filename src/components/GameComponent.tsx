import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { MainScene } from "../game/scenes/MainScene";
import { MultiplayerManager } from "./MultiplayerManager";

interface GameComponentProps {
  onPlayerCountChange?: (count: number) => void;
}

export function GameComponent({ onPlayerCountChange }: GameComponentProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MainScene | null>(null);
  const [isMultiplayerConnected, setIsMultiplayerConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(1);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: containerRef.current,
        backgroundColor: "#2d2d2d",
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        },
        scene: [MainScene]
      };

      gameRef.current = new Phaser.Game(config);
      
      // Store reference to the scene
      gameRef.current.events.on('ready', () => {
        sceneRef.current = gameRef.current?.scene.getScene('MainScene') as MainScene;
        
        // Set up player count listener
        if (sceneRef.current) {
          sceneRef.current.events.on('playerCountChanged', (count: number) => {
            setPlayerCount(count);
            if (onPlayerCountChange) {
              onPlayerCountChange(count);
            }
          });
        }
      });
    }

    return () => {
      if (gameRef.current) {
        if (sceneRef.current) {
          sceneRef.current.events.removeListener('playerCountChanged');
        }
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [onPlayerCountChange]);
  
  const handleServerConnected = (server: any) => {
    setIsMultiplayerConnected(true);
    
    // Pass server to the scene
    if (sceneRef.current) {
      sceneRef.current.setServer(server);
    } else {
      // If scene isn't ready yet, wait and try again
      const checkInterval = setInterval(() => {
        if (sceneRef.current) {
          sceneRef.current.setServer(server);
          clearInterval(checkInterval);
        }
      }, 100);
      
      // Clear interval after 5 seconds if scene still not ready
      setTimeout(() => clearInterval(checkInterval), 5000);
    }
  };
  
  const handleServerDisconnected = () => {
    setIsMultiplayerConnected(false);
  };

  return (
    <div className="relative">
      <MultiplayerManager 
        onConnected={handleServerConnected}
        onDisconnected={handleServerDisconnected}
      />
      <div ref={containerRef} id="game-container" />
      {!isMultiplayerConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800 p-4 rounded-lg text-white">
            서버에 연결 중입니다...
          </div>
        </div>
      )}
    </div>
  );
}
