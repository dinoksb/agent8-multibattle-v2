import Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 200;
  private attackCooldown: number = 0;
  private healthBar!: Phaser.GameObjects.Graphics;
  private health: number = 100;
  private maxHealth: number = 100;
  private _isAttacking: boolean = false;
  private _facingLeft: boolean = false;
  private lastAttackTime: number = 0;
  
  // 공격 히트박스 추가
  private attackHitbox!: Phaser.GameObjects.Rectangle;
  private attackRange: number = 60; // 공격 범위 축소 (100 -> 60)
  private attackDamage: number = 20; // 공격 데미지
  private debugMode: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "knight");
    
    // Add this game object to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set up physics body
    this.setSize(60, 80);
    this.setOffset(66, 80);
    this.setCollideWorldBounds(false);
    
    // Set scale to make the knight a bit smaller
    this.setScale(0.8);
    
    // Play idle animation
    this.play('knight-idle');
    
    // Create health bar
    this.createHealthBar();
    
    // 공격 히트박스 생성 (처음에는 비활성화)
    this.createAttackHitbox();
    
    // 디버그 모드 설정 이벤트 리스너
    this.scene.events.on('toggle-debug', (isEnabled: boolean) => {
      this.debugMode = isEnabled;
      // 히트박스가 활성화된 상태라면 디버그 시각화 업데이트
      if (this._isAttacking) {
        this.updateHitboxVisibility();
      }
    });
  }

  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasdKeys: {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
      SPACE: Phaser.Input.Keyboard.Key;
    }
  ) {
    // Don't handle input during attack animation
    if (this._isAttacking) {
      return;
    }
    
    // Handle movement
    const leftPressed = cursors.left.isDown || wasdKeys.A.isDown;
    const rightPressed = cursors.right.isDown || wasdKeys.D.isDown;
    const upPressed = cursors.up.isDown || wasdKeys.W.isDown;
    const downPressed = cursors.down.isDown || wasdKeys.S.isDown;
    
    // Reset velocity
    this.setVelocity(0);
    
    // Apply velocity based on input
    if (leftPressed) {
      this.setVelocityX(-this.speed);
      this._facingLeft = true;
      this.setFlipX(true);
    } else if (rightPressed) {
      this.setVelocityX(this.speed);
      this._facingLeft = false;
      this.setFlipX(false);
    }
    
    if (upPressed) {
      this.setVelocityY(-this.speed);
    } else if (downPressed) {
      this.setVelocityY(this.speed);
    }
    
    // Normalize velocity for diagonal movement
    if ((leftPressed || rightPressed) && (upPressed || downPressed)) {
      this.body.velocity.normalize().scale(this.speed);
    }
    
    // Set animation based on movement
    if (this.body.velocity.length() > 0) {
      if (this.anims.currentAnim?.key !== 'knight-move') {
        this.play('knight-move');
      }
    } else {
      if (this.anims.currentAnim?.key !== 'knight-idle') {
        this.play('knight-idle');
      }
    }
    
    // Handle attack
    if ((cursors.space.isDown || wasdKeys.SPACE.isDown) && this.attackCooldown <= 0 && !this._isAttacking) {
      this.attack();
    }
    
    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= this.scene.game.loop.delta;
    }
    
    // Update health bar position
    this.updateHealthBar();
    
    // 공격 히트박스 위치 업데이트
    this.updateAttackHitbox();
  }

  private createAttackHitbox() {
    // 공격 히트박스 생성 (처음에는 보이지 않음)
    this.attackHitbox = this.scene.add.rectangle(this.x, this.y, this.attackRange, 5, 0xff0000, 0);
    this.scene.physics.add.existing(this.attackHitbox, false);
    
    // 히트박스 물리 속성 설정
    const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    hitboxBody.setAllowGravity(false);
    hitboxBody.setImmovable(true);
    
    // 처음에는 비활성화
    this.attackHitbox.setActive(false);
    this.attackHitbox.setVisible(false);
    hitboxBody.enable = false;
  }

  private updateAttackHitbox() {
    // 공격 히트박스 위치 업데이트
    if (this._facingLeft) {
      this.attackHitbox.setPosition(this.x - this.attackRange / 2 - 10, this.y);
    } else {
      this.attackHitbox.setPosition(this.x + this.attackRange / 2 + 10, this.y);
    }
  }

  private attack() {
    this._isAttacking = true;
    this.attackCooldown = 800; // 800ms cooldown
    this.lastAttackTime = Date.now();
    
    // Stop movement during attack
    this.setVelocity(0);
    
    // Play attack animation
    this.play('knight-attack');
    
    // 공격 히트박스 활성화
    this.activateAttackHitbox();
    
    // Listen for animation completion
    this.once('animationcomplete', () => {
      this._isAttacking = false;
      this.play('knight-idle');
      
      // 공격 히트박스 비활성화
      this.deactivateAttackHitbox();
    });
    
    // 공격 히트박스는 300ms 동안만 활성화 (애니메이션 중 일부 프레임만)
    this.scene.time.delayedCall(300, () => {
      this.deactivateAttackHitbox();
    });
  }

  private activateAttackHitbox() {
    // 공격 히트박스 활성화
    this.attackHitbox.setActive(true);
    
    // 디버그 모드에 따라 히트박스 시각화
    this.updateHitboxVisibility();
    
    // 물리 바디 활성화
    const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    hitboxBody.enable = true;
    
    // 히트박스 위치 업데이트
    this.updateAttackHitbox();
  }

  private updateHitboxVisibility() {
    // 디버그 모드일 때만 히트박스 시각화
    if (this.debugMode) {
      this.attackHitbox.setVisible(true);
      this.attackHitbox.setFillStyle(0xff0000, 0.3);
      this.attackHitbox.setStrokeStyle(2, 0xff0000, 1);
    } else {
      this.attackHitbox.setVisible(false);
    }
  }

  private deactivateAttackHitbox() {
    // 공격 히트박스 비활성화
    this.attackHitbox.setActive(false);
    this.attackHitbox.setVisible(false);
    
    // 물리 바디 비활성화
    const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    hitboxBody.enable = false;
  }

  private createHealthBar() {
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar();
  }

  private updateHealthBar() {
    this.healthBar.clear();
    
    // Draw background
    this.healthBar.fillStyle(0x000000, 0.5);
    this.healthBar.fillRect(-25, -50, 50, 6);
    
    // Draw health
    const healthWidth = 50 * (this.health / this.maxHealth);
    this.healthBar.fillStyle(0x2ecc71, 1);
    this.healthBar.fillRect(-25, -50, healthWidth, 6);
    
    // Position the health bar
    this.healthBar.setPosition(this.x, this.y);
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();
    
    // Flash red when taking damage
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
    });
    
    if (this.health <= 0) {
      // Player is defeated
      this.setActive(false);
      this.setVisible(false);
      
      // Emit death event
      this.scene.events.emit('player-died');
    }
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.updateHealthBar();
  }
  
  respawn(x: number, y: number) {
    // Reset health
    this.health = this.maxHealth;
    this.updateHealthBar();
    
    // Reset position
    this.setPosition(x, y);
    
    // Make visible and active again
    this.setActive(true);
    this.setVisible(true);
    
    // Reset animation
    this.play('knight-idle');
  }
  
  getHealth() {
    return this.health;
  }
  
  isAttacking() {
    return this._isAttacking;
  }
  
  isFacingLeft() {
    return this._facingLeft;
  }
  
  getLastAttackTime() {
    return this.lastAttackTime;
  }
  
  getAttackHitbox() {
    return this.attackHitbox;
  }
  
  getAttackDamage() {
    return this.attackDamage;
  }
  
  // 디버그 모드 설정
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
    this.updateHitboxVisibility();
  }
  
  // 플레이어 파괴 시 히트박스도 함께 제거
  destroy(fromScene?: boolean) {
    if (this.attackHitbox) {
      this.attackHitbox.destroy();
    }
    if (this.healthBar) {
      this.healthBar.destroy();
    }
    super.destroy(fromScene);
  }
}
