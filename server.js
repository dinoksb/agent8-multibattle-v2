class Server {
  constructor() {
    this.initializeServer();
  }

  async initializeServer() {
    // 글로벌 상태 초기화
    const globalState = await $global.getGlobalState();
    if (!globalState.initialized) {
      await $global.updateGlobalState({
        initialized: true
      });
    }
  }

  // 게임 참가
  async joinGame(nickname) {
    try {
      // 기본 전투 방에 참가
      const roomId = await $global.joinRoom('combat-arena');
      
      // 플레이어 상태 초기화 - 랜덤한 위치에서 시작
      const randomX = 1000 + Math.floor(Math.random() * 500 - 250);
      const randomY = 1000 + Math.floor(Math.random() * 500 - 250);
      
      // 닉네임 설정 (제공되지 않은 경우 기본값 사용)
      const playerNickname = nickname || `Knight-${$sender.account.substring(0, 5)}`;
      
      await $room.updateMyState({
        nickname: playerNickname,
        position: {
          x: randomX,
          y: randomY
        },
        health: 100,
        isAttacking: false,
        facingLeft: false,
        lastAttackTime: 0,
        joinedAt: Date.now(),
        account: $sender.account
      });

      return { 
        success: true, 
        roomId,
        position: { x: randomX, y: randomY }
      };
    } catch (error) {
      console.error("Error joining game:", error);
      return { success: false, message: '게임 참가 중 오류가 발생했습니다.' };
    }
  }

  // 게임 떠날 때
  async leaveGame() {
    try {
      // 방 나가기
      await $global.leaveRoom();
      
      return { success: true };
    } catch (error) {
      console.error("Error leaving game:", error);
      return { success: false, message: '게임 퇴장 중 오류가 발생했습니다.' };
    }
  }

  // 플레이어 상태 업데이트
  async updatePlayerState(state) {
    if (!state) return { success: false };
    
    try {
      const myState = await $room.getMyState();
      await $room.updateMyState({
        ...myState,
        ...state,
        lastUpdated: Date.now()
      });
      
      return { success: true };
    } catch (error) {
      console.error("Error updating player state:", error);
      return { success: false };
    }
  }

  // 플레이어 공격 처리
  async hitPlayer(targetAccount, damage) {
    try {
      // 타겟 플레이어 상태 가져오기
      const targetState = await $room.getUserState(targetAccount);
      if (!targetState) {
        return { success: false, message: '대상 플레이어를 찾을 수 없습니다.' };
      }
      
      // 현재 체력 계산
      const currentHealth = targetState.health || 100;
      const newHealth = Math.max(0, currentHealth - damage);
      
      // 타겟 플레이어 상태 업데이트
      await $room.updateUserState(targetAccount, {
        health: newHealth
      });
      
      // 타겟 플레이어에게 피격 메시지 전송
      await $room.sendMessageToUser('hit', targetAccount, {
        damage,
        attackerId: $sender.account
      });
      
      return { 
        success: true,
        damage,
        newHealth
      };
    } catch (error) {
      console.error("Error hitting player:", error);
      return { success: false, message: '공격 처리 중 오류가 발생했습니다.' };
    }
  }

  // 플레이어 리스폰
  async respawnPlayer() {
    try {
      // 랜덤 위치 생성
      const randomX = 1000 + Math.floor(Math.random() * 500 - 250);
      const randomY = 1000 + Math.floor(Math.random() * 500 - 250);
      
      // 플레이어 상태 업데이트
      await $room.updateMyState({
        health: 100,
        position: {
          x: randomX,
          y: randomY
        },
        isAttacking: false
      });
      
      return { 
        success: true,
        position: { x: randomX, y: randomY }
      };
    } catch (error) {
      console.error("Error respawning player:", error);
      return { success: false, message: '리스폰 중 오류가 발생했습니다.' };
    }
  }

  // 모든 플레이어 정보 가져오기
  async getAllPlayers() {
    try {
      const allUsers = await $room.getAllUserStates();
      return { 
        players: allUsers.map(state => ({
          account: state.account,
          nickname: state.nickname,
          position: state.position,
          health: state.health,
          isAttacking: state.isAttacking,
          facingLeft: state.facingLeft,
          lastAttackTime: state.lastAttackTime
        }))
      };
    } catch (error) {
      console.error("Error getting all players:", error);
      return { players: [] };
    }
  }
}
