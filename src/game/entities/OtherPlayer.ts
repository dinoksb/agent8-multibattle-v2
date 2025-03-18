import Phaser from "phaser";

export class OtherPlayer extends Phaser.Physics.Arcade.Sprite {
  private account: string;
  private nickname: string;
  private health: number = 100;
  private isAttacking: boolean = false;
  private facingLeft: boolean = false;
  private lastAttackTime: number = 0;
  private attackHitbox: Phaser.GameObjects.Rectangle | null = null;
  private debugMode: boolean = false;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private healthBar: Phaser.GameObjects.Graphics;
  private nicknameText: Phaser.GameObjects.Text;
  private isDead: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, account: string, nickname: string) {
    super(scene, x, y, 'knight');
    
    this.account = account;
    this.nickname = nickname;
    
    // 씬이 활성화되어 있는지 확인
    if (!scene || !scene.sys || !scene.sys.displayList) {
      console.error('Scene is not properly initialized for OtherPlayer creation');
      return;
    }
    
    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set up physics body
    this.body.setSize(50, 50);
    this.body.setOffset(70, 120);
    
    // Set up display
    this.setScale(0.8);
    this.setDepth(10);
    
    // Create attack hitbox (initially inactive)
    this.createAttackHitbox();
    
    // Create health bar
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar();
    
    // Create nickname text
    this.nicknameText = this.scene.add.text(x, y - 70, nickname, {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    // Create debug graphics
    this.debugGraphics = this.scene.add.graphics();
    
    // Play idle animation
    this.play('knight-idle');
  }
  
  update() {
    if (this.isDead) return;
    
    // Update health bar and nickname position
    this.updateHealthBar();
    this.nicknameText.setPosition(this.x, this.y - 70);
    
    // Update debug graphics if enabled
    if (this.debugMode) {
      this.updateDebugGraphics();
    }
    
    // Update attack hitbox position
    this.updateAttackHitbox();
  }
  
  updateFromState(state: any) {
    if (this.isDead) return;
    
    // Update position if provided
    if (state.position) {
      this.setPosition(state.position.x, state.position.y);
      
      // Set velocity if provided
      if (state.position.velocityX !== undefined && state.position.velocityY !== undefined) {
        this.body.setVelocity(state.position.velocityX, state.position.velocityY);
      }
    }
    
    // Update health if provided
    if (state.health !== undefined) {
      this.health = state.health;
      this.updateHealthBar();
      
      // Check if player died
      if (this.health <= 0 && !this.isDead) {
        this.die();
      }
    }
    
    // Update attack state if provided
    if (state.isAttacking !== undefined) {
      if (state.isAttacking && !this.isAttacking) {
        this.startAttack();
      } else if (!state.isAttacking && this.isAttacking) {
        this.stopAttack();
      }
    }
    
    // Update facing direction if provided
    if (state.facingLeft !== undefined && state.facingLeft !== this.facingLeft) {
      this.facingLeft = state.facingLeft;
      this.setFlipX(this.facingLeft);
    }
    
    // Update last attack time if provided
    if (state.lastAttackTime !== undefined) {
      this.lastAttackTime = state.lastAttackTime;
    }
    
    // Update animation based on state
    this.updateAnimation();
  }
  
  private updateAnimation() {
    if (this.isDead) return;
    
    if (this.isAttacking) {
      if (!this.anims.isPlaying || this.anims.currentAnim.key !== 'knight-attack') {
        this.play('knight-attack');
      }
    } else if (this.body.velocity.x !== 0 || this.body.velocity.y !== 0) {
      if (!this.anims.isPlaying || this.anims.currentAnim.key !== 'knight-move') {
        this.play('knight-move');
      }
    } else {
      if (!this.anims.isPlaying || this.anims.currentAnim.key !== 'knight-idle') {
        this.play('knight-idle');
      }
    }
  }
  
  private createAttackHitbox() {
    // Create attack hitbox (initially inactive)
    this.attackHitbox = this.scene.add.rectangle(this.x, this.y, 60, 50, 0xff0000, 0);
    this.scene.physics.add.existing(this.attackHitbox, false);
    
    // Disable hitbox initially
    const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    hitboxBody.enable = false;
  }
  
  private updateAttackHitbox() {
    if (!this.attackHitbox) return;
    
    const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
    
    // Position hitbox based on facing direction
    const offsetX = this.facingLeft ? -40 : 40;
    this.attackHitbox.setPosition(this.x + offsetX, this.y);
    
    // Update debug visualization
    if (this.debugMode && hitboxBody.enable) {
      this.attackHitbox.setFillStyle(0xff0000, 0.3);
    } else {
      this.attackHitbox.setFillStyle(0xff0000, 0);
    }
  }
  
  private startAttack() {
    this.isAttacking = true;
    this.play('knight-attack');
    
    // Enable attack hitbox
    if (this.attackHitbox) {
      const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
      hitboxBody.enable = true;
      
      // Disable hitbox after attack animation completes
      this.scene.time.delayedCall(500, () => {
        this.stopAttack();
      });
    }
  }
  
  private stopAttack() {
    this.isAttacking = false;
    
    // Disable attack hitbox
    if (this.attackHitbox) {
      const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
      hitboxBody.enable = false;
    }
  }
  
  takeDamage(damage: number) {
    if (this.isDead) return;
    
    this.health = Math.max(0, this.health - damage);
    this.updateHealthBar();
    
    // Show damage number
    if (this.scene) {
      const mainScene = this.scene as any;
      if (mainScene.showDamageNumber) {
        mainScene.showDamageNumber(this.x, this.y, damage);
      }
    }
    
    // Check if player died
    if (this.health <= 0 && !this.isDead) {
      this.die();
    }
  }
  
  die() {
    this.isDead = true;
    
    // Change appearance
    this.setTint(0xff0000);
    
    // Disable physics
    this.body.enable = false;
    
    // Disable attack hitbox
    if (this.attackHitbox) {
      const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
      hitboxBody.enable = false;
    }
    
    // Store a reference to the scene and account before the tween starts
    const currentScene = this.scene;
    const playerAccount = this.account;
    
    // Safety check - if scene is already gone, clean up directly
    if (!currentScene) {
      this.cleanUp();
      return;
    }
    
    // Fade out
    currentScene.tweens.add({
      targets: [this, this.nicknameText, this.healthBar],
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        // Safety check - make sure scene still exists
        if (currentScene && currentScene.events) {
          // Emit event for player death
          currentScene.events.emit('other-player-died', playerAccount);
        }
        
        // Clean up
        this.cleanUp();
      }
    });
  }
  
  // Separate cleanup method to avoid duplication
  private cleanUp() {
    if (this.nicknameText) this.nicknameText.destroy();
    if (this.healthBar) this.healthBar.destroy();
    if (this.debugGraphics) this.debugGraphics.destroy();
    if (this.attackHitbox) this.attackHitbox.destroy();
  }
  
  private updateHealthBar() {
    if (!this.healthBar || this.isDead) return;
    
    this.healthBar.clear();
    
    // Background
    this.healthBar.fillStyle(0x000000, 0.7);
    this.healthBar.fillRect(this.x - 25, this.y - 50, 50, 8);
    
    // Health (green to red based on health percentage)
    const healthPercent = this.health / 100;
    const color = Phaser.Display.Color.GetColor(
      Math.floor(255 * (1 - healthPercent)),
      Math.floor(255 * healthPercent),
      0
    );
    
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(this.x - 25, this.y - 50, 50 * healthPercent, 8);
  }
  
  private updateDebugGraphics() {
    if (!this.debugGraphics) return;
    
    this.debugGraphics.clear();
    
    // Draw body
    this.debugGraphics.lineStyle(2, 0x00ff00, 1);
    this.debugGraphics.strokeRect(
      this.body.x,
      this.body.y,
      this.body.width,
      this.body.height
    );
    
    // Draw attack hitbox if active
    if (this.attackHitbox) {
      const hitboxBody = this.attackHitbox.body as Phaser.Physics.Arcade.Body;
      if (hitboxBody.enable) {
        this.debugGraphics.lineStyle(2, 0xff0000, 1);
        this.debugGraphics.strokeRect(
          hitboxBody.x,
          hitboxBody.y,
          hitboxBody.width,
          hitboxBody.height
        );
      }
    }
  }
  
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
    
    if (!enabled && this.debugGraphics) {
      this.debugGraphics.clear();
    }
  }
  
  getAttackHitbox() {
    return this.attackHitbox;
  }
  
  getAttackDamage() {
    return 20; // Fixed damage value
  }
  
  destroy() {
    // Clean up all associated objects
    this.cleanUp();
    
    super.destroy();
  }
}
