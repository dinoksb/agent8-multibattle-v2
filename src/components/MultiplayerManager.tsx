import { useEffect, useState } from 'react';
import { useGameServer } from '@agent8/gameserver';

interface MultiplayerManagerProps {
  onConnected: (server: any) => void;
  onDisconnected: () => void;
}

export function MultiplayerManager({ onConnected, onDisconnected }: MultiplayerManagerProps) {
  const { connected, server } = useGameServer();
  const [isJoined, setIsJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) {
      if (isJoined) {
        setIsJoined(false);
        onDisconnected();
      }
      return;
    }

    // Auto-join with a random nickname if not joined yet
    if (connected && !isJoined && !nickname) {
      const randomNickname = `Knight-${Math.floor(Math.random() * 1000)}`;
      setNickname(randomNickname);
      joinGame(randomNickname);
    }

    // Clean up when component unmounts
    return () => {
      if (connected && isJoined) {
        server.remoteFunction('leaveGame', [], { needResponse: false });
      }
    };
  }, [connected, isJoined]);

  const joinGame = async (playerNickname: string) => {
    if (!connected) return;
    
    try {
      setError(null);
      const result = await server.remoteFunction('joinGame', [playerNickname]);
      
      if (result.success) {
        setIsJoined(true);
        onConnected(server);
      } else {
        setError(result.message || '게임 참가에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to join game:', err);
      setError('게임 서버 연결에 실패했습니다.');
    }
  };

  // If not connected, show loading
  if (!connected) {
    return (
      <div className="fixed top-0 left-0 w-full bg-red-500 text-white p-2 text-center">
        서버에 연결 중...
      </div>
    );
  }

  // If there's an error, show it
  if (error) {
    return (
      <div className="fixed top-0 left-0 w-full bg-red-500 text-white p-2 text-center">
        오류: {error}
      </div>
    );
  }

  // If connected but not joined, show nothing (auto-join is in progress)
  if (!isJoined) {
    return (
      <div className="fixed top-0 left-0 w-full bg-yellow-500 text-white p-2 text-center">
        게임에 참가하는 중...
      </div>
    );
  }

  // If connected and joined, show connected status
  return (
    <div className="fixed top-0 left-0 w-full bg-green-500 text-white p-2 text-center">
      멀티플레이 연결됨: {nickname}
    </div>
  );
}
