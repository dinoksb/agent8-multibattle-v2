import Phaser from "phaser";
import { Player } from "../entities/Player";
import { OtherPlayer } from "../entities/OtherPlayer";

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private server: any;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private updateTimer: number = 0;
  private attackRange: number = 60; // 공격 범위 축소 (100 -> 60)
  private attackCooldown: number = 0;
  private hitEffects: Phaser.GameObjects.Group;
  private playerInfoText: Phaser.GameObjects.Text;
  private playerCountText: Phaser.GameObjects.Text;
  private playerCountPanel: Phaser.GameObjects.Image;
  private respawnButton: Phaser.GameObjects.Text;
  private lastHitTime: Map<string, number> = new Map(); // 플레이어별 마지막 피격 시간 저장
  private currentPlayerCount: number = 1;
  private isSceneReady: boolean = false;
  
  // 디버그 모드 관련 변수
  private debugMode: boolean = false;
  private debugButton!: Phaser.GameObjects.Text;
  private debugInfo!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    // Load knight sprite sheet
    this.load.spritesheet('knight', 
      'https://agent8-games.verse8.io/assets/2D/sprite_characters/medieval-knight.png',
      { frameWidth: 192, frameHeight: 192 }
    );
    
    // Load hit effect
    this.load.image('hit-effect', 
      'https://agent8-games.verse8.io/assets/2D/vampire_survival_riped_asset/projectile/sword.png'
    );
    
    // Load UI panel for player count
    this.load.image('panel-frame', 
      'https://agent8-games.verse8.io/assets/2D/vampire_survival_riped_asset/ui/frame/bg_frame_01.png'
    );
    
    // Load player icon
    this.load.image('player-icon', 
      'https://agent8-games.verse8.io/assets/2D/vampire_survival_riped_asset/ingame_icon/icon_gold.png'
    );
  }

  create() {
    // Create animations
    this.createAnimations();
    
    // Create the player at center of the world
    this.player = new Player(this, 1000, 1000);
    
    // Set up camera to follow player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1.2);
    
    // Create input controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    };
    
    // Create a simple background grid
    this.createBackgroundGrid();
    
    // Create hit effects group
    this.hitEffects = this.add.group();
    
    // Add player info text
    this.playerInfoText = this.add.text(16, 16, 'Health: 100', {
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setScrollFactor(0);
    
    // Create player count display
    this.createPlayerCountDisplay();
    
    // Create respawn button (hidden initially)
    this.respawnButton = this.add.text(
      this.cameras.main.width / 2, 
      this.cameras.main.height / 2, 
      '리스폰하기', 
      {
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#ff0000',
        padding: { x: 20, y: 10 }
      }
    )
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setInteractive()
    .on('pointerdown', () => this.respawnPlayer())
    .setVisible(false);
    
    // 디버그 모드 토글 버튼 추가
    this.createDebugUI();
    
    // Handle window resize
    this.scale.on('resize', this.handleResize, this);
    
    // Set up game over event
    this.events.on('player-died', this.handlePlayerDeath, this);
    
    // 다른 플레이어 사망 이벤트 리스너 추가
    this.events.on('other-player-died', this.handleOtherPlayerDeath, this);
    
    // 씬이 준비되었음을 표시
    this.isSceneReady = true;
    
    // 씬이 준비되면 서버에서 플레이어 정보 요청
    if (this.server) {
      this.requestAllPlayers();
    }
  }
  
  // 플레이어 수 표시 UI 생성
  private createPlayerCountDisplay() {
    // 패널 배경 추가
    this.playerCountPanel = this.add.image(
      this.cameras.main.width - 100, 
      80, 
      'panel-frame'
    )
    .setScrollFactor(0)
    .setScale(1.5)
    .setOrigin(0.5)
    .setDepth(90);
    
    // 플레이어 아이콘 추가
    const playerIcon = this.add.image(
      this.cameras.main.width - 130, 
      80, 
      'player-icon'
    )
    .setScrollFactor(0)
    .setScale(0.8)
    .setDepth(91);
    
    // 플레이어 수 텍스트 추가
    this.playerCountText = this.add.text(
      this.cameras.main.width - 100, 
      80, 
      '1', 
      {
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }
    )
    .setScrollFactor(0)
    .setOrigin(0.5)
    .setDepth(91);
    
    // 초기 플레이어 수 업데이트
    this.updatePlayerCount(1);
  }
  
  // 플레이어 수 업데이트
  private updatePlayerCount(count: number) {
    if (this.playerCountText) {
      this.playerCountText.setText(`${count}`);
    }
    
    // 플레이어 수가 변경되었을 때만 이벤트 발생
    if (this.currentPlayerCount !== count) {
      this.currentPlayerCount = count;
      // 이벤트 발생 - React 컴포넌트에서 이 이벤트를 수신
      this.events.emit('playerCountChanged', count);
    }
  }
  
  // 디버그 UI 생성
  private createDebugUI() {
    // 디버그 모드 토글 버튼
    this.debugButton = this.add.text(
      this.cameras.main.width - 150, 
      16, 
      '디버그 모드: OFF', 
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 10, y: 5 }
      }
    )
    .setScrollFactor(0)
    .setInteractive()
    .setDepth(100)
    .on('pointerdown', () => this.toggleDebugMode());
    
    // 디버그 정보 텍스트
    this.debugInfo = this.add.text(
      this.cameras.main.width - 150, 
      60, 
      '', 
      {
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
      }
    )
    .setScrollFactor(0)
    .setDepth(100)
    .setVisible(false);
  }
  
  // 디버그 모드 토글
  private toggleDebugMode() {
    this.debugMode = !this.debugMode;
    
    // 버튼 텍스트 업데이트
    this.debugButton.setText(`디버그 모드: ${this.debugMode ? 'ON' : 'OFF'}`);
    this.debugButton.setBackgroundColor(this.debugMode ? '#007700' : '#333333');
    
    // 디버그 정보 표시/숨김
    this.debugInfo.setVisible(this.debugMode);
    
    // 플레이어와 다른 플레이어들에게 디버그 모드 설정
    this.player.setDebugMode(this.debugMode);
    this.otherPlayers.forEach(player => player.setDebugMode(this.debugMode));
    
    // 이벤트 발생 (다른 객체들이 디버그 모드 변경을 감지할 수 있도록)
    this.events.emit('toggle-debug', this.debugMode);
    
    // 디버그 그래픽 활성화/비활성화
    if (this.debugMode) {
      this.physics.world.createDebugGraphic();
    } else {
      // 디버그 그래픽 제거
      const debugGraphic = this.children.getByName('__physics_debug');
      if (debugGraphic) {
        debugGraphic.destroy();
      }
    }
  }
  
  handleResize() {
    if (this.respawnButton) {
      this.respawnButton.setPosition(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2
      );
    }
    
    // 디버그 UI 위치 업데이트
    if (this.debugButton) {
      this.debugButton.setPosition(this.cameras.main.width - 150, 16);
    }
    
    if (this.debugInfo) {
      this.debugInfo.setPosition(this.cameras.main.width - 150, 60);
    }
    
    // 플레이어 수 표시 UI 위치 업데이트
    if (this.playerCountPanel) {
      this.playerCountPanel.setPosition(this.cameras.main.width - 100, 80);
    }
    
    if (this.playerCountText) {
      this.playerCountText.setPosition(this.cameras.main.width - 100, 80);
    }
  }
  
  setServer(server: any) {
    this.server = server;
    
    if (server) {
      // Subscribe to room state to get all players
      server.subscribeRoomState('combat-arena', (state: any) => {
        if (state && state.$users) {
          // 플레이어 수 업데이트
          this.updatePlayerCount(state.$users.length);
          
          // 씬이 준비된 경우에만 플레이어 정보 요청
          if (this.isSceneReady) {
            this.requestAllPlayers();
          }
        }
      });
      
      // Subscribe to all user states in the room
      server.subscribeRoomAllUserStates('combat-arena', (states: any[]) => {
        // 씬이 준비된 경우에만 다른 플레이어 업데이트
        if (this.isSceneReady) {
          this.updateOtherPlayers(states);
        }
      });
      
      // Listen for player join/leave events
      server.onRoomUserJoin('combat-arena', (account: string) => {
        console.log(`Player joined: ${account}`);
        // 플레이어 수 업데이트는 subscribeRoomState에서 처리됨
      });
      
      server.onRoomUserLeave('combat-arena', (account: string) => {
        if (this.isSceneReady) {
          this.handlePlayerLeave(account);
        }
        // 플레이어 수 업데이트는 subscribeRoomState에서 처리됨
      });
      
      // Listen for hit messages
      server.onRoomMessage('combat-arena', 'hit', (message: any) => {
        if (message && message.damage && this.isSceneReady) {
          this.player.takeDamage(message.damage);
          this.createHitEffect(this.player.x, this.player.y);
          
          // Check if player died
          if (this.player.getHealth() <= 0) {
            this.events.emit('player-died');
          }
        }
      });
      
      // 씬이 이미 준비된 경우 플레이어 위치 초기화
      if (this.isSceneReady) {
        this.initializePlayerPosition();
      }
    }
  }
  
  async initializePlayerPosition() {
    if (!this.server || !this.isSceneReady) return;
    
    try {
      const result = await this.server.remoteFunction('joinGame', ['']);
      if (result.success && result.position) {
        this.player.setPosition(result.position.x, result.position.y);
      }
    } catch (error) {
      console.error('Failed to initialize player position:', error);
    }
  }
  
  async requestAllPlayers() {
    if (!this.server || !this.isSceneReady) return;
    
    try {
      const result = await this.server.remoteFunction('getAllPlayers');
      if (result && result.players) {
        this.updateOtherPlayers(result.players);
      }
    } catch (error) {
      console.error('Failed to get all players:', error);
    }
  }
  
  updateOtherPlayers(players: any[]) {
    if (!players || !this.isSceneReady) return;
    
    // Filter out current player
    const otherPlayers = players.filter(player => 
      player.account !== this.server.account
    );
    
    // Update existing players and add new ones
    otherPlayers.forEach(player => {
      // 계정이 없는 경우 무시
      if (!player.account) {
        console.warn('Player without account found, skipping:', player);
        return;
      }
      
      const account = player.account;
      
      if (this.otherPlayers.has(account)) {
        // Update existing player
        const otherPlayer = this.otherPlayers.get(account);
        otherPlayer?.updateFromState(player);
      } else {
        try {
          // Add new player
          // account가 undefined인 경우 안전하게 처리
          const shortId = account && typeof account === 'string' ? account.substring(0, 5) : 'unknown';
          const nickname = player.nickname || `Knight-${shortId}`;
          const position = player.position || { x: 1000, y: 1000 };
          
          const otherPlayer = new OtherPlayer(
            this, 
            position.x, 
            position.y, 
            account, 
            nickname
          );
          
          // 디버그 모드 설정
          otherPlayer.setDebugMode(this.debugMode);
          
          otherPlayer.updateFromState(player);
          this.otherPlayers.set(account, otherPlayer);
          
          // Add collision with player
          this.physics.add.collider(this.player, otherPlayer);
        } catch (error) {
          console.error(`Error creating OtherPlayer for account ${account}:`, error);
        }
      }
    });
    
    // Remove players that are no longer in the game
    const currentAccounts = new Set(otherPlayers.map(p => p.account).filter(Boolean));
    
    this.otherPlayers.forEach((player, account) => {
      if (!currentAccounts.has(account)) {
        player.destroy();
        this.otherPlayers.delete(account);
      }
    });
  }
  
  handlePlayerLeave(account: string) {
    if (this.otherPlayers.has(account)) {
      const player = this.otherPlayers.get(account);
      player?.destroy();
      this.otherPlayers.delete(account);
    }
  }
  
  // 다른 플레이어 사망 처리
  handleOtherPlayerDeath(account: string) {
    console.log(`Other player died: ${account}`);
    
    // 사망 메시지 표시
    if (this.otherPlayers.has(account)) {
      const player = this.otherPlayers.get(account);
      if (player) {
        // 사망 메시지 표시
        const deathText = this.add.text(player.x, player.y - 100, '사망!', {
          fontSize: '24px',
          color: '#ff0000',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5);
        
        // 사망 메시지 애니메이션
        this.tweens.add({
          targets: deathText,
          y: player.y - 150,
          alpha: 0,
          duration: 2000,
          onComplete: () => {
            deathText.destroy();
          }
        });
        
        // 일정 시간 후 맵에서 제거
        this.time.delayedCall(3000, () => {
          if (this.otherPlayers.has(account)) {
            this.otherPlayers.delete(account);
          }
        });
      }
    }
  }
  
  update(time: number, delta: number) {
    if (!this.player.active || !this.isSceneReady) return;
    
    // Update player
    this.player.update(this.cursors, this.wasdKeys);
    
    // Update other players
    this.otherPlayers.forEach(player => player.update());
    
    // Update player info text
    this.playerInfoText.setText(`Health: ${this.player.getHealth()}`);
    
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    
    // 플레이어 공격 히트박스와 다른 플레이어 충돌 체크
    if (this.player.isAttacking()) {
      this.checkPlayerAttackCollisions();
    }
    
    // 다른 플레이어 공격 히트박스와 플레이어 충돌 체크
    this.checkOtherPlayersAttackCollisions();
    
    // Send player state to server periodically
    this.updateTimer += delta;
    if (this.updateTimer >= 100) { // Update every 100ms
      this.updateTimer = 0;
      this.sendPlayerState();
    }
    
    // 디버그 정보 업데이트
    if (this.debugMode) {
      this.updateDebugInfo();
    }
  }
  
  // 디버그 정보 업데이트
  private updateDebugInfo() {
    const playerPos = `플레이어 위치: X=${Math.floor(this.player.x)}, Y=${Math.floor(this.player.y)}`;
    const playerHealth = `체력: ${this.player.getHealth()}`;
    const attackState = `공격 중: ${this.player.isAttacking() ? 'YES' : 'NO'}`;
    const otherPlayersCount = `다른 플레이어: ${this.otherPlayers.size}명`;
    
    this.debugInfo.setText([
      playerPos,
      playerHealth,
      attackState,
      otherPlayersCount,
      `공격 범위: ${this.attackRange}px`,
      `히트박스 높이: 50px`
    ]);
  }
  
  // 플레이어 공격과 다른 플레이어 충돌 체크
  checkPlayerAttackCollisions() {
    const playerHitbox = this.player.getAttackHitbox();
    if (!playerHitbox || !playerHitbox.active) return;
    
    this.otherPlayers.forEach((otherPlayer, account) => {
      // 올바른 충돌 감지 방법 사용
      const isOverlapping = this.physics.overlap(
        playerHitbox,
        otherPlayer
      );
      
      if (isOverlapping) {
        // 마지막 피격 시간 확인 (연속 피격 방지)
        const lastHit = this.lastHitTime.get(account) || 0;
        const now = Date.now();
        
        // 1초에 한 번만 피격 가능
        if (now - lastHit > 1000) {
          // 피격 처리
          otherPlayer.takeDamage(this.player.getAttackDamage());
          
          // 피격 효과 생성
          this.createHitEffect(otherPlayer.x, otherPlayer.y);
          
          // 피격 시간 업데이트
          this.lastHitTime.set(account, now);
          
          // 서버에 피격 알림
          this.sendHitToServer(account, this.player.getAttackDamage());
        }
      }
    });
  }
  
  // 다른 플레이어 공격과 플레이어 충돌 체크
  checkOtherPlayersAttackCollisions() {
    if (!this.player.active) return;
    
    this.otherPlayers.forEach((otherPlayer, account) => {
      const otherHitbox = otherPlayer.getAttackHitbox();
      if (!otherHitbox || !otherHitbox.active) return;
      
      // 올바른 충돌 감지 방법 사용
      const isOverlapping = this.physics.overlap(
        otherHitbox,
        this.player
      );
      
      if (isOverlapping) {
        // 마지막 피격 시간 확인 (연속 피격 방지)
        const lastHit = this.lastHitTime.get('player') || 0;
        const now = Date.now();
        
        // 1초에 한 번만 피격 가능
        if (now - lastHit > 1000) {
          // 피격 처리
          this.player.takeDamage(otherPlayer.getAttackDamage());
          
          // 피격 효과 생성
          this.createHitEffect(this.player.x, this.player.y);
          
          // 피격 시간 업데이트
          this.lastHitTime.set('player', now);
          
          // 플레이어 사망 체크
          if (this.player.getHealth() <= 0) {
            this.events.emit('player-died');
          }
        }
      }
    });
  }
  
  async sendPlayerState() {
    if (!this.server || !this.player.active) return;
    
    try {
      const state = {
        position: {
          x: this.player.x,
          y: this.player.y,
          velocityX: this.player.body.velocity.x,
          velocityY: this.player.body.velocity.y
        },
        health: this.player.getHealth(),
        isAttacking: this.player.isAttacking(),
        facingLeft: this.player.isFacingLeft(),
        lastAttackTime: this.player.getLastAttackTime()
      };
      
      await this.server.remoteFunction('updatePlayerState', [state], {
        throttle: 100 // Throttle updates to reduce network traffic
      });
    } catch (error) {
      console.error('Failed to update player state:', error);
    }
  }
  
  async sendHitToServer(targetAccount: string, damage: number) {
    if (!this.server) return;
    
    try {
      await this.server.remoteFunction('hitPlayer', [
        targetAccount,
        damage
      ]);
    } catch (error) {
      console.error('Failed to send hit to server:', error);
    }
  }
  
  createHitEffect(x: number, y: number) {
    const effect = this.add.image(x, y, 'hit-effect');
    effect.setScale(1.5);
    effect.setAlpha(0.8);
    
    // Random rotation
    effect.setAngle(Phaser.Math.Between(0, 360));
    
    // Animation
    this.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 0.5,
      duration: 300,
      onComplete: () => {
        effect.destroy();
      }
    });
  }
  
  showDamageNumber(x: number, y: number, damage: number) {
    const text = this.add.text(x, y - 20, `-${damage}`, {
      fontSize: '24px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        text.destroy();
      }
    });
  }
  
  handlePlayerDeath() {
    // Show respawn button
    this.respawnButton.setVisible(true);
  }
  
  async respawnPlayer() {
    if (!this.server) return;
    
    try {
      const result = await this.server.remoteFunction('respawnPlayer');
      
      if (result.success) {
        // Reset player
        this.player.respawn(result.position.x, result.position.y);
        
        // Hide respawn button
        this.respawnButton.setVisible(false);
      }
    } catch (error) {
      console.error('Failed to respawn player:', error);
    }
  }

  private createAnimations() {
    // Idle animation
    this.anims.create({
      key: 'knight-idle',
      frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
    
    // Move animation
    this.anims.create({
      key: 'knight-move',
      frames: this.anims.generateFrameNumbers('knight', { start: 4, end: 11 }),
      frameRate: 12,
      repeat: -1
    });
    
    // Attack animation
    this.anims.create({
      key: 'knight-attack',
      frames: this.anims.generateFrameNumbers('knight', { start: 12, end: 17 }),
      frameRate: 15,
      repeat: 0
    });
  }

  private createBackgroundGrid() {
    const graphics = this.add.graphics();
    
    // Draw grid
    graphics.lineStyle(1, 0x333333, 0.8);
    
    // Vertical lines
    for (let x = 0; x < 2000; x += 50) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, 2000);
    }
    
    // Horizontal lines
    for (let y = 0; y < 2000; y += 50) {
      graphics.moveTo(0, y);
      graphics.lineTo(2000, y);
    }
    
    graphics.strokePath();
    
    // Add some random decorative elements
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(50, 1950);
      const y = Phaser.Math.Between(50, 1950);
      const size = Phaser.Math.Between(5, 15);
      const color = 0x333333;
      
      graphics.fillStyle(color, 0.5);
      graphics.fillCircle(x, y, size);
    }
  }
}
