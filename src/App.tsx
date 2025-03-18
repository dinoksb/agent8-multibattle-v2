import { useEffect, useRef, useState } from "react";
import "./App.css";
import { GameComponent } from "./components/GameComponent";

function App() {
  const [playerCount, setPlayerCount] = useState(1);

  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <h1 className="text-3xl font-bold text-white mb-4">중세 기사 전투 게임</h1>
      <div className="border-4 border-gray-700 rounded-lg overflow-hidden">
        <GameComponent onPlayerCountChange={handlePlayerCountChange} />
      </div>
      <div className="mt-4 text-white">
        <p>이동: WASD 또는 화살표 키, 공격: 스페이스바</p>
        <p className="mt-2 text-yellow-300">다른 플레이어에게 가까이 가서 스페이스바를 누르면 공격할 수 있습니다.</p>
        <p className="mt-2 text-blue-300">현재 접속 중인 플레이어: {playerCount}명</p>
      </div>
    </div>
  );
}

export default App;
