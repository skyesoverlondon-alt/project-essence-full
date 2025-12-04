/**
 * ============================================================
 * ESSENCE CROWN: SHARD WARS - DIGITAL TCG TABLETOP
 * ============================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * 
 * 1. GAME STATE (Game.state object ~line 6300):
 *    - players[0] / players[1]: Player data (essence, kl, deck, hand, avatarRow, etc.)
 *    - currentPlayer: 0 = human player, 1 = AI/opponent
 *    - currentPhase: dawn, draw, main, clash, twilight
 *    - turnNumber: Current turn counter
 *    - combat: Combat state (declaredAttackers, declaredBlockers, tempDamage)
 *    - gameOver: Boolean flag for game end
 * 
 * 2. TURN/PHASE ENGINE:
 *    - Game.setPhase(phase): Sets current phase, triggers phase effects
 *    - Game.nextPhase(): Advances to next phase
 *    - Game.endTurn(): Ends turn, switches players
 *    - Phases: dawn -> draw -> main -> clash -> twilight -> (end turn)
 * 
 * 3. COMBAT ENGINE:
 *    - Game.declareAttacker(): Player selects attacking Avatar
 *    - Game.declareBlocker(): Opponent assigns blockers
 *    - Game.resolveCombat(): Power vs Guard damage resolution
 *    - tempDamage tracking for simultaneous damage
 * 
 * 4. WIN CONDITIONS (Game.triggerGameEnd):
 *    - essence: Player essence <= 0
 *    - deck_out: Cannot draw from empty deck (mandatory draw)
 *    - concede: Player surrenders
 *    - timeout: Turn timer expired
 * 
 * 5. SCREEN NAVIGATION:
 *    - MainMenu.selectMode(mode): Switch between menu overlays
 *    - MainMenu.back(): Return to main menu
 *    - Game.showDeitySelection(): Deity picker before match
 *    - Game.returnToMenu(): Exit match to menu
 *    - Game.showVictoryScreen(): Display win/loss results
 * 
 * 6. KEY MANAGERS:
 *    - AIManager: AI opponent logic
 *    - CampaignManager: Story mode progression
 *    - DeckBuilder: Deck construction interface
 *    - RewardsSystem: Shard currency and rank rewards
 *    - PlayerProfile: Player customization and stats
 * 
 * Last Updated: December 2025
 * ============================================================
 */

// ===== GAME SETTINGS CONFIG =====
const GAME_SETTINGS = {
    enableAnimations: true,
    autoPassReactions: false,
    showReactionBar: true,
    animationSpeed: 1.0,
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.4,
    sfxVolume: 0.6
};

// ===== ESSENCE CROWN BATTLE ENGINE: HELPER FUNCTIONS =====
/**
 * Check if a card has the Guardian keyword (must be attacked first)
 * @param {Object} card - The card to check
 * @returns {boolean} True if card has Guardian ability
 */
function hasGuardian(card) {
    if (!card) return false;
    
    // Check for Guardian keyword in effect text
    if (card.effect) {
        const effect = card.effect.toLowerCase();
        if (effect.includes('guardian') || effect.includes('must be attacked first')) {
            return true;
        }
    }
    
    // Check for Guardian in keywords array
    if (card.keywords && Array.isArray(card.keywords)) {
        return card.keywords.some(k => k.toLowerCase() === 'guardian');
    }
    
    // Check for guard flag
    if (card.guard === true || card.isGuardian === true) {
        return true;
    }
    
    return false;
}

/**
 * Check if a card has the Haste/Swift keyword (can attack immediately)
 * @param {Object} card - The card to check
 * @returns {boolean} True if card has Haste ability
 */
function hasHaste(card) {
    if (!card) return false;
    
    if (card.effect) {
        const effect = card.effect.toLowerCase();
        if (effect.includes('haste') || effect.includes('swift') || effect.includes('rush')) {
            return true;
        }
    }
    
    if (card.keywords && Array.isArray(card.keywords)) {
        return card.keywords.some(k => 
            ['haste', 'swift', 'rush'].includes(k.toLowerCase())
        );
    }
    
    return card.haste === true;
}

// ===== SUN ALTAR VISUAL HELPERS =====
const SunAltarUI = {
    domainMap: {
        'Second Sun': 'second-sun',
        'Nullgrid': 'nullgrid',
        'New Earth': 'new-earth',
        'Crownline': 'crownline',
        'Gray Court': 'gray-court',
        'Shattered Sun': 'shattered-sun',
        'Sanctuary Void': 'sanctuary-void',
        'Solara': 'solara'
    },
    
    setActiveDomain(domainName) {
        const arena = document.getElementById('ec-arena-frame');
        if (!arena) return;
        const domainKey = this.domainMap[domainName] || 'new-earth';
        arena.setAttribute('data-domain', domainKey);
        const nameEl = document.getElementById('active-domain-name');
        if (nameEl) nameEl.textContent = domainName || 'New Earth';
    },
    
    updateKLPips(playerIndex, current, max) {
        const pipsContainer = document.getElementById(`p${playerIndex + 1}-kl-pips`);
        if (!pipsContainer) return;
        
        let html = '';
        for (let i = 0; i < max; i++) {
            const state = i < current ? 'active' : 'spent';
            html += `<div class="kl-pip ${state}"></div>`;
        }
        pipsContainer.innerHTML = html;
    },
    
    triggerDeityAbility(playerIndex) {
        const ring = document.querySelector(`#p${playerIndex + 1}-deity-zone`);
        if (ring) {
            ring.classList.add('ability-active');
            setTimeout(() => ring.classList.remove('ability-active'), 800);
        }
    },
    
    playDamageBurst(element, damage) {
        if (!element || !GAME_SETTINGS.enableAnimations) return;
        const burst = document.createElement('div');
        burst.className = 'damage-burst';
        burst.innerHTML = `<span style="color:#ef4444;font-weight:bold;font-size:24px;">-${damage}</span>`;
        const rect = element.getBoundingClientRect();
        burst.style.left = `${rect.left + rect.width / 2 - 30}px`;
        burst.style.top = `${rect.top + rect.height / 2 - 30}px`;
        burst.style.position = 'fixed';
        burst.style.zIndex = '9999';
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 600);
    },
    
    playEssenceFlare(element) {
        if (!element || !GAME_SETTINGS.enableAnimations) return;
        const flare = document.createElement('div');
        flare.className = 'essence-flare';
        const rect = element.getBoundingClientRect();
        flare.style.left = `${rect.left + rect.width / 2 - 40}px`;
        flare.style.top = `${rect.top + rect.height / 2 - 40}px`;
        flare.style.position = 'fixed';
        flare.style.zIndex = '9998';
        document.body.appendChild(flare);
        setTimeout(() => flare.remove(), 700);
    },
    
    showSigil(element, sigil) {
        if (!element || !GAME_SETTINGS.enableAnimations) return;
        const sigilEl = document.createElement('div');
        sigilEl.className = 'sigil-overlay';
        sigilEl.textContent = sigil;
        const rect = element.getBoundingClientRect();
        sigilEl.style.left = `${rect.left + rect.width / 2 - 20}px`;
        sigilEl.style.top = `${rect.top + rect.height / 2 - 20}px`;
        sigilEl.style.position = 'fixed';
        sigilEl.style.zIndex = '9999';
        document.body.appendChild(sigilEl);
        setTimeout(() => sigilEl.remove(), 700);
    }
};

// ===== SHATTERED SUN CHRONICLE PANEL =====
const ChroniclePanel = {
    isVisible: false,
    currentChapter: null,
    
    show(chapterData) {
        const panel = document.getElementById('chronicle-panel');
        if (!panel) return;
        
        panel.classList.remove('hidden');
        this.isVisible = true;
        this.currentChapter = chapterData;
        
        if (chapterData) {
            this.update(chapterData);
        }
    },
    
    hide() {
        const panel = document.getElementById('chronicle-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
        this.isVisible = false;
    },
    
    toggle() {
        const content = document.getElementById('chronicle-content');
        const btn = document.querySelector('.chronicle-toggle');
        if (content && btn) {
            content.classList.toggle('collapsed');
            btn.textContent = content.classList.contains('collapsed') ? '+' : '−';
        }
    },
    
    update(chapterData) {
        const actEl = document.getElementById('chronicle-act');
        const chapterEl = document.getElementById('chronicle-chapter');
        const storyEl = document.getElementById('chronicle-story');
        const progressEl = document.getElementById('chronicle-progress');
        
        if (actEl && chapterData.act) {
            actEl.textContent = `Act ${chapterData.act}`;
        }
        if (chapterEl && chapterData.title) {
            chapterEl.textContent = chapterData.title;
        }
        if (storyEl && chapterData.story) {
            storyEl.textContent = chapterData.story;
        }
        if (progressEl && chapterData.chapterId) {
            this.updateProgress(chapterData.chapterId);
        }
    },
    
    updateProgress(currentChapterId) {
        const progressEl = document.getElementById('chronicle-progress');
        if (!progressEl) return;
        
        let html = '';
        for (let i = 1; i <= 10; i++) {
            let state = '';
            if (i < currentChapterId) state = 'complete';
            else if (i === currentChapterId) state = 'current';
            html += `<div class="progress-node ${state}">${i}</div>`;
        }
        progressEl.innerHTML = html;
    }
};

// ===== AUDIO MANAGER =====
const AudioManager = {
    currentTrack: null,
    audioElement: null,
    sfxPool: {},
    fadeInterval: null,
    
    tracks: {
        menu: 'https://cdn.pixabay.com/audio/2024/02/14/audio_72a5c37df7.mp3',
        battle: 'https://cdn.pixabay.com/audio/2024/11/13/audio_28e22e43c8.mp3',
        battle_intense: 'https://cdn.pixabay.com/audio/2024/03/25/audio_4c0b0f6f8c.mp3',
        victory: 'https://cdn.pixabay.com/audio/2022/03/15/audio_942e22b3fa.mp3',
        defeat: 'https://cdn.pixabay.com/audio/2024/04/04/audio_ea55c73e79.mp3',
        campaign: 'https://cdn.pixabay.com/audio/2024/09/10/audio_6e5d7d1912.mp3',
        boss: 'https://cdn.pixabay.com/audio/2023/10/17/audio_c8e4dd4a32.mp3'
    },
    
    init() {
        this.audioElement = document.createElement('audio');
        this.audioElement.id = 'ec-background-music';
        this.audioElement.loop = true;
        this.audioElement.volume = GAME_SETTINGS.musicVolume;
        document.body.appendChild(this.audioElement);
        
        const savedVolume = localStorage.getItem('ec-music-volume');
        const savedEnabled = localStorage.getItem('ec-music-enabled');
        if (savedVolume !== null) GAME_SETTINGS.musicVolume = parseFloat(savedVolume);
        if (savedEnabled !== null) GAME_SETTINGS.musicEnabled = savedEnabled === 'true';
        
        this.audioElement.volume = GAME_SETTINGS.musicVolume;
        
        document.addEventListener('click', () => {
            if (GAME_SETTINGS.musicEnabled && !this.currentTrack) {
                this.play('menu');
            }
        }, { once: true });
    },
    
    play(trackName, fadeIn = true) {
        if (!GAME_SETTINGS.musicEnabled) return;
        if (this.currentTrack === trackName) return;
        
        const track = this.tracks[trackName];
        if (!track) return;
        
        if (fadeIn && this.audioElement.src) {
            this.fadeOut(() => {
                this.loadAndPlay(track, trackName);
            });
        } else {
            this.loadAndPlay(track, trackName);
        }
    },
    
    loadAndPlay(src, trackName) {
        this.audioElement.src = src;
        this.audioElement.volume = 0;
        this.currentTrack = trackName;
        
        const playPromise = this.audioElement.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.fadeIn();
            }).catch(e => {
                console.log('Audio autoplay blocked, waiting for user interaction');
            });
        }
    },
    
    fadeIn(duration = 1000) {
        const targetVolume = GAME_SETTINGS.musicVolume;
        const steps = 20;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;
        let currentStep = 0;
        
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        
        this.fadeInterval = setInterval(() => {
            currentStep++;
            this.audioElement.volume = Math.min(volumeStep * currentStep, targetVolume);
            if (currentStep >= steps) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
            }
        }, stepTime);
    },
    
    fadeOut(callback, duration = 500) {
        const startVolume = this.audioElement.volume;
        const steps = 10;
        const stepTime = duration / steps;
        const volumeStep = startVolume / steps;
        let currentStep = 0;
        
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        
        this.fadeInterval = setInterval(() => {
            currentStep++;
            this.audioElement.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
            if (currentStep >= steps) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                this.audioElement.pause();
                if (callback) callback();
            }
        }, stepTime);
    },
    
    stop() {
        this.fadeOut(() => {
            this.currentTrack = null;
        });
    },
    
    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
        }
    },
    
    resume() {
        if (this.audioElement && GAME_SETTINGS.musicEnabled) {
            this.audioElement.play().catch(() => {});
        }
    },
    
    setVolume(volume) {
        GAME_SETTINGS.musicVolume = volume;
        if (this.audioElement) {
            this.audioElement.volume = volume;
        }
        localStorage.setItem('ec-music-volume', volume);
    },
    
    toggleMusic() {
        GAME_SETTINGS.musicEnabled = !GAME_SETTINGS.musicEnabled;
        localStorage.setItem('ec-music-enabled', GAME_SETTINGS.musicEnabled);
        
        if (GAME_SETTINGS.musicEnabled) {
            this.play('menu');
        } else {
            this.stop();
        }
        return GAME_SETTINGS.musicEnabled;
    },
    
    playSFX(name) {
        if (!GAME_SETTINGS.sfxEnabled) return;
        
        const sfxUrls = {
            card_play: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8b8abb5b4.mp3',
            attack: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8c90e8fb6e.mp3',
            damage: 'https://cdn.pixabay.com/audio/2021/08/04/audio_c507296979.mp3',
            draw: 'https://cdn.pixabay.com/audio/2022/10/30/audio_f96fc71f30.mp3',
            click: 'https://cdn.pixabay.com/audio/2022/03/10/audio_6c483c1c0a.mp3'
        };
        
        const url = sfxUrls[name];
        if (!url) return;
        
        const sfx = new Audio(url);
        sfx.volume = GAME_SETTINGS.sfxVolume;
        sfx.play().catch(() => {});
    }
};

// ===== ANIMATION HELPERS =====
const AnimationHelper = {
    play(type, element, options = {}) {
        if (!GAME_SETTINGS.enableAnimations) return Promise.resolve();
        
        return new Promise(resolve => {
            const duration = (options.duration || 400) / GAME_SETTINGS.animationSpeed;
            
            switch(type) {
                case 'manifest':
                    this.manifestAnimation(element, duration, resolve);
                    break;
                case 'aspect-impact':
                    this.aspectImpact(element, duration, resolve);
                    break;
                case 'essence-damage':
                    this.essenceDamage(element, options.amount, options.isHeal, resolve);
                    break;
                case 'shard-claim':
                    this.shardClaim(element, resolve);
                    break;
                case 'stat-pulse':
                    this.statPulse(element, options.color, resolve);
                    break;
                case 'crown':
                    this.crownOverlay(options.isVictory, resolve);
                    break;
                default:
                    resolve();
            }
        });
    },
    
    manifestAnimation(slot, duration, callback) {
        if (!slot) return callback?.();
        slot.classList.add('ec-anim-manifest');
        const card = slot.querySelector('.game-card');
        if (card) {
            card.classList.add('ec-anim-manifest-card');
        }
        setTimeout(() => {
            slot.classList.remove('ec-anim-manifest');
            slot.classList.add('ec-anim-manifest-complete');
            if (card) card.classList.remove('ec-anim-manifest-card');
            setTimeout(() => slot.classList.remove('ec-anim-manifest-complete'), 300);
            callback?.();
        }, duration);
    },
    
    aspectImpact(element, duration, callback) {
        if (!element) return callback?.();
        element.classList.add('ec-anim-aspect-impact');
        setTimeout(() => {
            element.classList.remove('ec-anim-aspect-impact');
            callback?.();
        }, duration);
    },
    
    essenceDamage(targetElement, amount, isHeal = false, callback) {
        if (!targetElement) return callback?.();
        const rect = targetElement.getBoundingClientRect();
        const floater = document.createElement('div');
        floater.className = `ec-damage-floater ${isHeal ? 'heal' : 'damage'}`;
        floater.textContent = `${isHeal ? '+' : '-'}${Math.abs(amount)} Essence`;
        floater.style.left = `${rect.left + rect.width / 2}px`;
        floater.style.top = `${rect.top}px`;
        document.body.appendChild(floater);
        
        requestAnimationFrame(() => floater.classList.add('animate'));
        setTimeout(() => {
            floater.remove();
            callback?.();
        }, 1200);
    },
    
    shardClaim(shardElement, callback) {
        if (!shardElement) return callback?.();
        shardElement.classList.add('ec-anim-shard-claim');
        setTimeout(() => {
            shardElement.classList.remove('ec-anim-shard-claim');
            shardElement.classList.add('ec-shard--claimed');
            callback?.();
        }, 600);
    },
    
    statPulse(element, color = 'gold', callback) {
        if (!element) return callback?.();
        element.classList.add(`ec-pulse-${color}`);
        setTimeout(() => {
            element.classList.remove(`ec-pulse-${color}`);
            callback?.();
        }, 400);
    },
    
    crownOverlay(isVictory, callback) {
        const overlay = document.getElementById('ec-crown-overlay');
        const title = document.getElementById('ec-crown-title');
        if (!overlay || !title) return callback?.();
        
        overlay.classList.remove('victory', 'defeat');
        overlay.classList.add(isVictory ? 'victory' : 'defeat');
        title.textContent = isVictory ? 'CROWN CLAIMED' : 'ESSENCE SHATTERED';
        overlay.classList.add('visible');
        
        setTimeout(() => {
            overlay.classList.remove('visible');
            callback?.();
        }, 3000);
    }
};

// ===== REACTION BAR SYSTEM =====
const ReactionBar = {
    visible: false,
    currentOptions: [],
    onRespond: null,
    onPass: null,
    
    show(options = {}) {
        if (!GAME_SETTINGS.showReactionBar) return;
        if (GAME_SETTINGS.autoPassReactions && (!options.cards || options.cards.length === 0)) {
            options.onPass?.();
            return;
        }
        
        this.visible = true;
        this.currentOptions = options.cards || [];
        this.onRespond = options.onRespond;
        this.onPass = options.onPass;
        
        const bar = document.getElementById('ec-reaction-bar');
        if (!bar) return;
        
        const prompt = bar.querySelector('.ec-reaction-prompt');
        const cardsContainer = bar.querySelector('.ec-reaction-cards');
        
        if (prompt) prompt.textContent = options.prompt || 'You may respond';
        
        if (cardsContainer) {
            cardsContainer.innerHTML = '';
            this.currentOptions.slice(0, 3).forEach(card => {
                const btn = document.createElement('button');
                btn.className = 'ec-reaction-card-btn';
                btn.textContent = card.name;
                btn.onclick = () => this.selectCard(card);
                cardsContainer.appendChild(btn);
            });
        }
        
        bar.classList.add('visible');
    },
    
    hide() {
        this.visible = false;
        const bar = document.getElementById('ec-reaction-bar');
        if (bar) bar.classList.remove('visible');
    },
    
    selectCard(card) {
        this.hide();
        this.onRespond?.(card);
    },
    
    pass() {
        this.hide();
        this.onPass?.();
    },
    
    respond() {
        if (this.currentOptions.length === 1) {
            this.selectCard(this.currentOptions[0]);
        } else if (this.currentOptions.length > 1) {
            this.currentOptions.forEach(c => {
                const cardEl = document.querySelector(`[data-card-id="${c.instanceId}"]`);
                if (cardEl) cardEl.classList.add('ec-reaction-candidate');
            });
        }
    },
    
    toggleAutoPass() {
        GAME_SETTINGS.autoPassReactions = !GAME_SETTINGS.autoPassReactions;
        const toggle = document.getElementById('ec-autopass-toggle');
        if (toggle) toggle.checked = GAME_SETTINGS.autoPassReactions;
        localStorage.setItem('ec_autopass', GAME_SETTINGS.autoPassReactions);
    },
    
    init() {
        GAME_SETTINGS.autoPassReactions = localStorage.getItem('ec_autopass') === 'true';
        const toggle = document.getElementById('ec-autopass-toggle');
        if (toggle) toggle.checked = GAME_SETTINGS.autoPassReactions;
    }
};

// ===== TARGETING VISUAL SYSTEM =====
const TargetingVisuals = {
    activeLine: null,
    
    showTargetable(elements) {
        elements.forEach(el => el.classList.add('ec-targetable'));
    },
    
    clearTargetable() {
        document.querySelectorAll('.ec-targetable').forEach(el => el.classList.remove('ec-targetable'));
        document.querySelectorAll('.ec-targeted').forEach(el => el.classList.remove('ec-targeted'));
        this.clearLine();
    },
    
    setTargeted(element) {
        document.querySelectorAll('.ec-targeted').forEach(el => el.classList.remove('ec-targeted'));
        if (element) element.classList.add('ec-targeted');
    },
    
    drawLine(sourceElement, targetElement) {
        if (!sourceElement || !targetElement) return;
        this.clearLine();
        
        const sourceRect = sourceElement.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        const sx = sourceRect.left + sourceRect.width / 2;
        const sy = sourceRect.top + sourceRect.height / 2;
        const tx = targetRect.left + targetRect.width / 2;
        const ty = targetRect.top + targetRect.height / 2;
        
        const angle = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI;
        const distance = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
        
        const line = document.createElement('div');
        line.className = 'ec-target-line';
        line.style.left = `${sx}px`;
        line.style.top = `${sy}px`;
        line.style.width = `${distance}px`;
        line.style.transform = `rotate(${angle}deg)`;
        
        document.body.appendChild(line);
        this.activeLine = line;
        
        requestAnimationFrame(() => line.classList.add('visible'));
    },
    
    clearLine() {
        if (this.activeLine) {
            this.activeLine.remove();
            this.activeLine = null;
        }
    }
};

// ===== ENHANCED PLAYER PROFILE SYSTEM =====
const FullscreenToggle = {
    toggle() {
        const elem = document.documentElement;
        const btn = document.getElementById('btn-fullscreen');
        
        if (!document.fullscreenElement) {
            elem.requestFullscreen?.() || 
            elem.webkitRequestFullscreen?.() || 
            elem.mozRequestFullScreen?.() || 
            elem.msRequestFullscreen?.();
            
            btn?.classList.add('active');
        } else {
            document.exitFullscreen?.() || 
            document.webkitExitFullscreen?.() || 
            document.mozCancelFullScreen?.() || 
            document.msExitFullscreen?.();
            
            btn?.classList.remove('active');
        }
    }
};

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('btn-fullscreen');
    if (document.fullscreenElement) {
        btn?.classList.add('active');
    } else {
        btn?.classList.remove('active');
    }
});

const GameControls = {
    toggleFullscreen() {
        FullscreenToggle.toggle();
    },
    
    showPause() {
        document.getElementById('pause-overlay').classList.remove('hidden');
    },
    
    resume() {
        document.getElementById('pause-overlay').classList.add('hidden');
    },
    
    goHome() {
        this.resume();
        if (typeof Game !== 'undefined' && Game.state && !Game.state.gameOver) {
            if (confirm('Are you sure you want to quit? Your match progress will be lost.')) {
                Game.returnToMenu();
            }
        } else {
            Game.returnToMenu();
        }
    },
    
    surrender() {
        this.resume();
        if (typeof Game !== 'undefined' && Game.state && !Game.state.gameOver) {
            if (confirm('Are you sure you want to surrender?')) {
                Game.state.gameOver = true;
                Game.endGame(false);
            }
        }
    }
};

const PlayerProfile = {
    data: {
        name: 'Sovereign',
        avatar: '👑',
        title: 'Initiate',
        motto: '',
        cardBack: 'default',
        border: 'bronze',
        favoriteDeity: '',
        matches: 0,
        wins: 0,
        losses: 0,
        shards: 0,
        bestStreak: 0,
        currentStreak: 0,
        matchHistory: []
    },
    
    avatarMap: {
        cosmic: '🌌', void: '🌑', essence: '✨', divine: '👑', inferno: '🔥', storm: '⚡'
    },
    
    init() {
        this.loadProfile();
        this.updateDisplay();
        this.populateDeitySelect();
    },
    
    loadProfile() {
        const saved = localStorage.getItem('ec-player-profile');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.data = { ...this.data, ...parsed };
        }
    },
    
    saveProfile() {
        const nameInput = document.getElementById('profile-name-input');
        const mottoInput = document.getElementById('profile-motto-input');
        
        if (nameInput && nameInput.value.trim()) {
            this.data.name = nameInput.value.trim();
        }
        if (mottoInput) {
            this.data.motto = mottoInput.value.trim();
        }
        
        localStorage.setItem('ec-player-profile', JSON.stringify(this.data));
        this.updateDisplay();
        this.closeModal();
        
        BattleEffects.screenFlash('#d4af3744', 300);
    },
    
    selectAvatar(avatar) {
        this.data.avatar = this.avatarMap[avatar] || '👑';
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        document.querySelector(`[data-avatar="${avatar}"]`)?.classList.add('selected');
    },
    
    selectTitle(title) {
        const el = document.querySelector(`[data-title="${title}"]`);
        if (el && el.classList.contains('locked')) return;
        
        this.data.title = title;
        document.querySelectorAll('.title-option').forEach(el => el.classList.remove('selected'));
        document.querySelector(`[data-title="${title}"]`)?.classList.add('selected');
    },
    
    selectCardBack(cardBack) {
        this.data.cardBack = cardBack;
        document.querySelectorAll('.cardback-option').forEach(el => el.classList.remove('selected'));
        document.querySelector(`[data-cardback="${cardBack}"]`)?.classList.add('selected');
    },
    
    selectBorder(border) {
        const el = document.querySelector(`[data-border="${border}"]`);
        if (el && el.classList.contains('locked')) return;
        
        this.data.border = border;
        document.querySelectorAll('.border-option').forEach(el => el.classList.remove('selected'));
        document.querySelector(`[data-border="${border}"]`)?.classList.add('selected');
    },
    
    selectFavoriteDeity(deityName) {
        this.data.favoriteDeity = deityName;
    },
    
    populateDeitySelect() {
        const select = document.getElementById('profile-deity-select');
        if (!select || typeof getDeities !== 'function') return;
        
        const deities = getDeities();
        deities.forEach(deity => {
            const option = document.createElement('option');
            option.value = deity.name;
            option.textContent = deity.name;
            select.appendChild(option);
        });
    },
    
    switchTab(tabName) {
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        document.querySelectorAll('.profile-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
        
        if (tabName === 'stats') {
            this.updateStatsDisplay();
        }
    },
    
    updateStatsDisplay() {
        const winRate = this.data.matches > 0 ? Math.round((this.data.wins / this.data.matches) * 100) : 0;
        
        document.getElementById('stat-matches').textContent = this.data.matches;
        document.getElementById('stat-wins').textContent = this.data.wins;
        document.getElementById('stat-losses').textContent = this.data.losses;
        document.getElementById('stat-winrate').textContent = `${winRate}%`;
        document.getElementById('stat-streak').textContent = this.data.bestStreak;
        
        const campaign = JSON.parse(localStorage.getItem('ec-campaign-progress') || '{}');
        const completed = Object.values(campaign).filter(v => v === true).length;
        document.getElementById('stat-campaign').textContent = `${completed}/10`;
        
        this.renderMatchHistory();
    },
    
    renderMatchHistory() {
        const container = document.getElementById('match-history-list');
        if (!container) return;
        
        if (this.data.matchHistory.length === 0) {
            container.innerHTML = '<div class="no-matches">No battles yet. Begin your legend!</div>';
            return;
        }
        
        container.innerHTML = this.data.matchHistory.slice(-10).reverse().map(match => `
            <div class="match-entry ${match.won ? 'win' : 'loss'}">
                <span class="match-result">${match.won ? '✓' : '✗'}</span>
                <span class="match-opponent">${match.opponent || 'Unknown'}</span>
                <span class="match-mode">${match.mode || 'Battle'}</span>
            </div>
        `).join('');
    },
    
    showModal() {
        const modal = document.getElementById('profile-modal');
        modal.classList.remove('hidden');
        
        document.getElementById('profile-name-input').value = this.data.name;
        document.getElementById('profile-motto-input').value = this.data.motto || '';
        
        const reverseAvatarMap = Object.fromEntries(
            Object.entries(this.avatarMap).map(([k, v]) => [v, k])
        );
        const currentAvatar = reverseAvatarMap[this.data.avatar];
        document.querySelectorAll('.avatar-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.avatar === currentAvatar);
        });
        
        document.querySelectorAll('.title-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.title === this.data.title);
        });
        
        document.querySelectorAll('.cardback-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.cardback === this.data.cardBack);
        });
        
        document.querySelectorAll('.border-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.border === this.data.border);
        });
        
        const deitySelect = document.getElementById('profile-deity-select');
        if (deitySelect) deitySelect.value = this.data.favoriteDeity;
        
        this.switchTab('identity');
    },
    
    closeModal() {
        document.getElementById('profile-modal').classList.add('hidden');
    },
    
    updateDisplay() {
        const menuName = document.getElementById('menu-player-name');
        const menuAvatar = document.getElementById('menu-avatar');
        const menuRank = document.getElementById('menu-player-rank');
        const menuShards = document.getElementById('menu-shards');
        
        if (menuName) menuName.textContent = this.data.name;
        if (menuAvatar) menuAvatar.textContent = this.data.avatar;
        if (menuRank) {
            const winRate = this.data.matches > 0 ? Math.round((this.data.wins / this.data.matches) * 100) : 0;
            menuRank.textContent = `${this.data.title} • ${winRate}% WR`;
        }
        if (menuShards) menuShards.textContent = this.data.shards;
    },
    
    recordMatch(won, opponentName = 'AI', mode = 'Battle') {
        this.data.matches++;
        if (won) {
            this.data.wins++;
            this.data.currentStreak++;
            if (this.data.currentStreak > this.data.bestStreak) {
                this.data.bestStreak = this.data.currentStreak;
            }
        } else {
            this.data.losses++;
            this.data.currentStreak = 0;
        }
        
        this.data.matchHistory.push({
            won,
            opponent: opponentName,
            mode,
            timestamp: Date.now()
        });
        
        if (this.data.matchHistory.length > 50) {
            this.data.matchHistory = this.data.matchHistory.slice(-50);
        }
        
        this.unlockTitles();
        
        localStorage.setItem('ec-player-profile', JSON.stringify(this.data));
        this.updateDisplay();
    },
    
    unlockTitles() {
        if (this.data.wins >= 10) {
            document.querySelector('[data-title="Champion"]')?.classList.remove('locked');
        }
        if (this.data.wins >= 25) {
            document.querySelector('[data-title="Deity Slayer"]')?.classList.remove('locked');
        }
    },
    
    addShards(amount) {
        this.data.shards += amount;
        localStorage.setItem('ec-player-profile', JSON.stringify(this.data));
        this.updateDisplay();
    },
    
    unlockedTitles: JSON.parse(localStorage.getItem('ec-unlocked-titles') || '["Initiate"]'),
    
    unlockTitle(title) {
        if (!this.unlockedTitles.includes(title)) {
            this.unlockedTitles.push(title);
            localStorage.setItem('ec-unlocked-titles', JSON.stringify(this.unlockedTitles));
        }
    },
    
    isTitleUnlocked(title) {
        return this.unlockedTitles.includes(title);
    }
};

// ===== MATCH INTRO CINEMATIC =====
const MatchIntro = {
    battleQuotes: [
        "The Essence flows... destiny awaits!",
        "Only one shall claim the Crown!",
        "Let the Shards decide your fate!",
        "The void hungers for essence!",
        "Ancient powers awaken!",
        "Steel your soul, Shardkeeper!",
        "The deities watch with interest...",
        "May your essence burn eternal!"
    ],
    
    show(player1, player2, p1Deity, p2Deity) {
        return new Promise((resolve) => {
            const intro = document.getElementById('match-intro');
            if (!intro) { resolve(); return; }
            
            document.getElementById('intro-p1-avatar').textContent = PlayerProfile.data.avatar;
            document.getElementById('intro-p1-name').textContent = PlayerProfile.data.name;
            document.getElementById('intro-p1-title').textContent = PlayerProfile.data.title;
            document.getElementById('intro-p1-deity').textContent = `⚔ ${p1Deity?.name || 'Unknown Deity'}`;
            
            document.getElementById('intro-p2-avatar').textContent = '🤖';
            document.getElementById('intro-p2-name').textContent = player2 || 'Opponent';
            document.getElementById('intro-p2-title').textContent = 'Challenger';
            document.getElementById('intro-p2-deity').textContent = `⚔ ${p2Deity?.name || 'Unknown Deity'}`;
            
            const quote = this.battleQuotes[Math.floor(Math.random() * this.battleQuotes.length)];
            document.getElementById('intro-quote').textContent = `"${quote}"`;
            
            intro.classList.remove('hidden');
            intro.classList.add('animating');
            
            BattleEffects.screenFlash('#ffffff', 200);
            
            setTimeout(() => {
                intro.classList.add('vs-slam');
                BattleEffects.screenShake(20, 300);
            }, 800);
            
            setTimeout(() => {
                intro.classList.add('fade-out');
                setTimeout(() => {
                    intro.classList.remove('animating', 'vs-slam', 'fade-out');
                    intro.classList.add('hidden');
                    resolve();
                }, 500);
            }, 3500);
        });
    }
};

// ===== BATTLE EFFECTS ENGINE =====
// Premium immersive battle system rivaling Pokemon/Yu-Gi-Oh with MTG depth

const BattleEffects = {
    particles: [],
    activeEffects: [],
    canvas: null,
    ctx: null,
    animationFrame: null,
    
    init() {
        this.createCanvas();
        this.startLoop();
    },
    
    createCanvas() {
        if (this.canvas) return;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'effects-canvas';
        this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },
    
    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },
    
    startLoop() {
        const loop = () => {
            this.update();
            this.draw();
            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    },
    
    update() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.vy += p.gravity || 0;
            return p.life > 0;
        });
    },
    
    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = p.glow || 10;
            
            if (p.type === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.type === 'star') {
                this.drawStar(p.x, p.y, p.size * p.life, p.rotation || 0);
            } else if (p.type === 'spark') {
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = p.color;
                this.ctx.beginPath();
                this.ctx.moveTo(p.x, p.y);
                this.ctx.lineTo(p.x - p.vx * 5, p.y - p.vy * 5);
                this.ctx.stroke();
            } else if (p.type === 'energy') {
                const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                gradient.addColorStop(0, p.color);
                gradient.addColorStop(1, 'transparent');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            }
            
            this.ctx.restore();
            if (p.rotation !== undefined) p.rotation += 0.1;
        });
    },
    
    drawStar(cx, cy, size, rotation) {
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size / 2;
        
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(rotation);
        this.ctx.beginPath();
        
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            if (i === 0) this.ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            else this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    },
    
    // ===== SCREEN EFFECTS =====
    
    screenShake(intensity = 10, duration = 300) {
        const board = document.getElementById('game-board') || document.body;
        const startTime = Date.now();
        
        const shake = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < duration) {
                const decay = 1 - (elapsed / duration);
                const x = (Math.random() - 0.5) * intensity * decay;
                const y = (Math.random() - 0.5) * intensity * decay;
                board.style.transform = `translate(${x}px, ${y}px)`;
                requestAnimationFrame(shake);
            } else {
                board.style.transform = '';
            }
        };
        shake();
    },
    
    screenFlash(color = '#ffffff', duration = 200) {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        flash.style.backgroundColor = color;
        document.body.appendChild(flash);
        
        requestAnimationFrame(() => flash.style.opacity = '0.8');
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 300);
        }, duration);
    },
    
    chromaticAberration(duration = 500) {
        const board = document.getElementById('game-board');
        if (board) {
            board.classList.add('chromatic-aberration');
            setTimeout(() => board.classList.remove('chromatic-aberration'), duration);
        }
    },
    
    slowMotion(duration = 1000) {
        document.body.classList.add('slow-motion');
        setTimeout(() => document.body.classList.remove('slow-motion'), duration);
    },
    
    // ===== PARTICLE BURSTS =====
    
    burstAt(x, y, count = 30, options = {}) {
        const colors = options.colors || ['#d4af37', '#00ffcc', '#9333ea', '#ffffff'];
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = (options.speed || 5) + Math.random() * 3;
            
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: (options.size || 8) + Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1,
                decay: 0.02 + Math.random() * 0.02,
                type: options.type || 'circle',
                gravity: options.gravity || 0,
                glow: options.glow || 15,
                rotation: Math.random() * Math.PI * 2
            });
        }
    },
    
    energyBeam(fromX, fromY, toX, toY, color = '#00ffcc', callback) {
        const duration = 400;
        const startTime = Date.now();
        
        const beam = document.createElement('div');
        beam.className = 'energy-beam';
        beam.style.cssText = `
            left: ${fromX}px;
            top: ${fromY}px;
            background: linear-gradient(90deg, transparent, ${color}, ${color}, transparent);
            box-shadow: 0 0 30px ${color}, 0 0 60px ${color};
        `;
        
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
        beam.style.width = '0px';
        beam.style.transform = `rotate(${angle}rad)`;
        
        document.body.appendChild(beam);
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            beam.style.width = `${distance * progress}px`;
            
            // Spawn trail particles
            if (progress < 1 && Math.random() > 0.5) {
                const px = fromX + (toX - fromX) * progress;
                const py = fromY + (toY - fromY) * progress;
                this.particles.push({
                    x: px + (Math.random() - 0.5) * 10,
                    y: py + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: 4 + Math.random() * 3,
                    color: color,
                    life: 1,
                    decay: 0.05,
                    type: 'energy',
                    glow: 20
                });
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(() => {
                    beam.style.opacity = '0';
                    setTimeout(() => beam.remove(), 200);
                    if (callback) callback();
                }, 100);
            }
        };
        animate();
    },
    
    // ===== CARD EFFECTS =====
    
    cardSummon(cardElement, cardType = 'Avatar') {
        const rect = cardElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        
        // Add summon class
        cardElement.classList.add('summoning');
        
        // Portal effect
        this.createPortal(cx, cy, cardType);
        
        // Screen effects
        this.screenFlash(this.getTypeColor(cardType), 100);
        this.screenShake(5, 200);
        
        // Burst particles
        setTimeout(() => {
            this.burstAt(cx, cy, 40, {
                colors: [this.getTypeColor(cardType), '#ffffff', '#d4af37'],
                speed: 8,
                type: 'star',
                glow: 25
            });
            cardElement.classList.remove('summoning');
            cardElement.classList.add('summoned');
        }, 400);
    },
    
    createPortal(x, y, type) {
        const portal = document.createElement('div');
        portal.className = 'summon-portal';
        portal.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            border-color: ${this.getTypeColor(type)};
            box-shadow: 0 0 50px ${this.getTypeColor(type)}, 
                        inset 0 0 30px ${this.getTypeColor(type)};
        `;
        document.body.appendChild(portal);
        
        // Inner rings
        for (let i = 0; i < 3; i++) {
            const ring = document.createElement('div');
            ring.className = 'portal-ring';
            ring.style.animationDelay = `${i * 0.1}s`;
            portal.appendChild(ring);
        }
        
        setTimeout(() => {
            portal.classList.add('collapse');
            setTimeout(() => portal.remove(), 500);
        }, 600);
    },
    
    getTypeColor(type) {
        const colors = {
            'Avatar': '#00ffcc',
            'Spell': '#9333ea',
            'Domain': '#22c55e',
            'Relic': '#d4af37',
            'Glow': '#00ffcc',
            'Void': '#9333ea',
            'Gray': '#6b7280',
            'damage': '#ff4444',
            'heal': '#00ff88'
        };
        return colors[type] || '#d4af37';
    },
    
    spellCast(cardElement, aspects = []) {
        const rect = cardElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        
        cardElement.classList.add('spell-casting');
        
        // Rune circle
        this.createRuneCircle(cx, cy, aspects[0] || 'Void');
        
        // Screen effects
        this.screenFlash('#9333ea', 150);
        this.chromaticAberration(300);
        
        // Magic particles spiral
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const angle = (i / 50) * Math.PI * 4;
                const radius = 100 - (i * 2);
                this.particles.push({
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius,
                    vx: Math.cos(angle) * -3,
                    vy: Math.sin(angle) * -3,
                    size: 6,
                    color: this.getTypeColor(aspects[0] || 'Spell'),
                    life: 1,
                    decay: 0.03,
                    type: 'energy',
                    glow: 20
                });
            }, i * 10);
        }
        
        setTimeout(() => cardElement.classList.remove('spell-casting'), 600);
    },
    
    createRuneCircle(x, y, aspect) {
        const rune = document.createElement('div');
        rune.className = 'rune-circle';
        rune.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            border-color: ${this.getTypeColor(aspect)};
        `;
        rune.innerHTML = `
            <div class="rune-inner"></div>
            <div class="rune-symbols">✧ ◈ ✦ ◇ ✧ ◈ ✦ ◇</div>
        `;
        document.body.appendChild(rune);
        
        setTimeout(() => {
            rune.classList.add('fade-out');
            setTimeout(() => rune.remove(), 500);
        }, 800);
    },
    
    // ===== COMBAT EFFECTS =====
    
    attackSlash(fromElement, toElement, callback) {
        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();
        
        const fromX = fromRect.left + fromRect.width / 2;
        const fromY = fromRect.top + fromRect.height / 2;
        const toX = toRect.left + toRect.width / 2;
        const toY = toRect.top + toRect.height / 2;
        
        // Attacker lunge
        fromElement.classList.add('attack-lunge');
        
        // Trail sparks
        this.energyBeam(fromX, fromY, toX, toY, '#ff6600', () => {
            // Impact explosion
            this.impactExplosion(toX, toY);
            this.screenShake(15, 300);
            this.screenFlash('#ff4444', 100);
            
            // Slash marks
            this.createSlashMark(toX, toY);
            
            toElement.classList.add('hit-impact');
            setTimeout(() => {
                toElement.classList.remove('hit-impact');
                fromElement.classList.remove('attack-lunge');
                if (callback) callback();
            }, 400);
        });
    },
    
    impactExplosion(x, y) {
        // Central burst
        this.burstAt(x, y, 50, {
            colors: ['#ff4444', '#ff6600', '#ffaa00', '#ffffff'],
            speed: 12,
            size: 10,
            type: 'spark',
            glow: 30
        });
        
        // Shockwave ring
        const ring = document.createElement('div');
        ring.className = 'shockwave-ring';
        ring.style.cssText = `left: ${x}px; top: ${y}px;`;
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 600);
        
        // Debris particles
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15 - 5,
                size: 3 + Math.random() * 4,
                color: '#666',
                life: 1,
                decay: 0.02,
                type: 'circle',
                gravity: 0.3,
                glow: 5
            });
        }
    },
    
    createSlashMark(x, y) {
        const slash = document.createElement('div');
        slash.className = 'slash-mark';
        slash.style.cssText = `left: ${x}px; top: ${y}px;`;
        slash.innerHTML = '<div class="slash-line"></div><div class="slash-line"></div>';
        document.body.appendChild(slash);
        setTimeout(() => {
            slash.classList.add('fade-out');
            setTimeout(() => slash.remove(), 500);
        }, 300);
    },
    
    directAttack(attackerElement, targetPlayerIndex) {
        if (!attackerElement) {
            this.screenShake(15, 300);
            return;
        }
        
        const rect = attackerElement.getBoundingClientRect();
        const fromX = rect.left + rect.width / 2;
        const fromY = rect.top + rect.height / 2;
        
        // Target opponent's essence display
        const targetY = targetPlayerIndex === 0 ? window.innerHeight - 100 : 100;
        const targetX = window.innerWidth / 2;
        
        attackerElement.classList.add('direct-attack-charge');
        
        setTimeout(() => {
            this.energyBeam(fromX, fromY, targetX, targetY, '#ff0000', () => {
                this.screenShake(25, 400);
                this.screenFlash('#ff0000', 200);
                this.impactExplosion(targetX, targetY);
                
                // Extra dramatic effects
                this.chromaticAberration(500);
                document.body.classList.add('essence-damage-pulse');
                setTimeout(() => document.body.classList.remove('essence-damage-pulse'), 500);
                
                if (attackerElement) attackerElement.classList.remove('direct-attack-charge');
            });
        }, 300);
    },
    
    // ===== DAMAGE/HEAL EFFECTS =====
    
    showDamageNumber(x, y, amount, type = 'damage') {
        const num = document.createElement('div');
        num.className = `damage-number ${type}`;
        num.textContent = type === 'damage' ? `-${amount}` : `+${amount}`;
        num.style.cssText = `left: ${x}px; top: ${y}px;`;
        document.body.appendChild(num);
        
        // Particles around number
        this.burstAt(x, y, 15, {
            colors: [type === 'damage' ? '#ff4444' : '#00ff88'],
            speed: 3,
            size: 4,
            glow: 10
        });
        
        setTimeout(() => num.remove(), 1500);
    },
    
    essenceChange(playerIndex, oldValue, newValue) {
        const diff = newValue - oldValue;
        const essenceDisplay = document.querySelector(`.player-stats[data-player="${playerIndex}"] .essence-value`) ||
                               document.querySelector(playerIndex === 0 ? '.bottom-stats .essence-value' : '.top-stats .essence-value');
        
        if (essenceDisplay) {
            const rect = essenceDisplay.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            if (diff < 0) {
                essenceDisplay.classList.add('essence-damage');
                this.showDamageNumber(x, y - 30, Math.abs(diff), 'damage');
                this.burstAt(x, y, 20, { colors: ['#ff4444', '#ff0000'], speed: 5 });
                setTimeout(() => essenceDisplay.classList.remove('essence-damage'), 500);
            } else if (diff > 0) {
                essenceDisplay.classList.add('essence-heal');
                this.showDamageNumber(x, y - 30, diff, 'heal');
                this.burstAt(x, y, 20, { colors: ['#00ff88', '#00ffcc'], speed: 5, type: 'star' });
                setTimeout(() => essenceDisplay.classList.remove('essence-heal'), 500);
            }
        }
    },
    
    klSpend(playerIndex, amount) {
        const klDisplay = document.querySelector(playerIndex === 0 ? '.bottom-stats .kl-value' : '.top-stats .kl-value');
        if (klDisplay) {
            klDisplay.classList.add('kl-spend');
            const rect = klDisplay.getBoundingClientRect();
            
            // Energy drain particles
            for (let i = 0; i < amount * 5; i++) {
                this.particles.push({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    vx: (Math.random() - 0.5) * 10,
                    vy: -Math.random() * 5 - 3,
                    size: 6,
                    color: '#ffaa00',
                    life: 1,
                    decay: 0.03,
                    type: 'energy',
                    glow: 15
                });
            }
            
            setTimeout(() => klDisplay.classList.remove('kl-spend'), 300);
        }
    },
    
    // ===== PHASE TRANSITIONS =====
    
    phaseTransition(phaseName) {
        const overlay = document.createElement('div');
        overlay.className = 'phase-transition-overlay';
        overlay.innerHTML = `
            <div class="phase-transition-content">
                <div class="phase-transition-line left"></div>
                <div class="phase-transition-text">${phaseName}</div>
                <div class="phase-transition-line right"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Cinematic particles
        const colors = {
            'Dawn Phase': ['#ffcc00', '#ff9900'],
            'Draw Phase': ['#00ccff', '#0066ff'],
            'Main Phase': ['#00ffcc', '#00ff66'],
            'Clash Phase': ['#ff4444', '#ff0000'],
            'Twilight Phase': ['#9933ff', '#6600cc']
        };
        
        const phaseColors = colors[phaseName] || ['#d4af37', '#ffffff'];
        
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                this.particles.push({
                    x: Math.random() * window.innerWidth,
                    y: window.innerHeight / 2 + (Math.random() - 0.5) * 100,
                    vx: (Math.random() - 0.5) * 20,
                    vy: (Math.random() - 0.5) * 5,
                    size: 8 + Math.random() * 8,
                    color: phaseColors[Math.floor(Math.random() * phaseColors.length)],
                    life: 1,
                    decay: 0.02,
                    type: 'energy',
                    glow: 25
                });
            }, i * 20);
        }
        
        setTimeout(() => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 500);
        }, 1200);
    },
    
    // ===== LOW HEALTH & CRITICAL EFFECTS =====
    
    lowHealthWarning(playerIndex) {
        const badge = document.getElementById(playerIndex === 0 ? 'p1-life-badge' : 'p2-life-badge');
        if (!badge) return;
        
        badge.classList.add('low-health-pulse');
        document.body.classList.add('low-health-vignette');
        
        const rect = badge.getBoundingClientRect();
        this.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 30, {
            colors: ['#ff0000', '#ff4444', '#880000'],
            speed: 3,
            size: 5,
            glow: 20
        });
    },
    
    clearLowHealthWarning(playerIndex) {
        const badge = document.getElementById(playerIndex === 0 ? 'p1-life-badge' : 'p2-life-badge');
        if (badge) badge.classList.remove('low-health-pulse');
        document.body.classList.remove('low-health-vignette');
    },
    
    criticalMoment(text = 'CRITICAL!') {
        this.slowMotion(1500);
        this.chromaticAberration(1000);
        
        const overlay = document.createElement('div');
        overlay.className = 'critical-moment-overlay';
        overlay.innerHTML = `<div class="critical-text">${text}</div>`;
        document.body.appendChild(overlay);
        
        this.screenShake(30, 500);
        
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 400,
                y: window.innerHeight / 2 + (Math.random() - 0.5) * 200,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                size: 10 + Math.random() * 10,
                color: ['#ff0000', '#ffcc00', '#ff6600'][Math.floor(Math.random() * 3)],
                life: 1,
                decay: 0.02,
                type: 'star',
                glow: 40
            });
        }
        
        setTimeout(() => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 500);
        }, 1500);
    },
    
    lethalWarning() {
        const warning = document.createElement('div');
        warning.className = 'lethal-warning';
        warning.innerHTML = `
            <div class="lethal-text">⚠ LETHAL ON BOARD ⚠</div>
        `;
        document.body.appendChild(warning);
        
        this.screenFlash('#ff000066', 300);
        
        setTimeout(() => {
            warning.classList.add('fade-out');
            setTimeout(() => warning.remove(), 500);
        }, 2000);
    },
    
    chainReaction(count) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                this.screenFlash('#9333ea44', 100);
                this.screenShake(5 + i * 2, 100);
                
                this.particles.push({
                    x: window.innerWidth / 2 + (Math.random() - 0.5) * 300,
                    y: window.innerHeight / 2 + (Math.random() - 0.5) * 200,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15,
                    size: 15,
                    color: '#9333ea',
                    life: 1,
                    decay: 0.03,
                    type: 'star',
                    glow: 30
                });
            }, i * 200);
        }
    },
    
    creatureDestroyed(element) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        
        element.classList.add('destroying');
        
        this.screenShake(12, 300);
        this.screenFlash('#ff444488', 150);
        
        this.burstAt(cx, cy, 60, {
            colors: ['#ff4444', '#ff6600', '#ffaa00', '#333333'],
            speed: 15,
            size: 8,
            type: 'spark',
            glow: 20
        });
        
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: cx + (Math.random() - 0.5) * 50,
                y: cy + (Math.random() - 0.5) * 50,
                vx: (Math.random() - 0.5) * 10,
                vy: Math.random() * -10 - 5,
                size: 5 + Math.random() * 5,
                color: '#444',
                life: 1,
                decay: 0.015,
                type: 'circle',
                gravity: 0.3,
                glow: 5
            });
        }
        
        setTimeout(() => {
            element.classList.remove('destroying');
        }, 600);
    },
    
    cardDrawAnimation(cardElement) {
        if (!cardElement) return;
        
        cardElement.classList.add('card-drawing');
        
        const rect = cardElement.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: cx,
                y: cy - 100,
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 5 + 2,
                size: 4,
                color: '#00ffcc',
                life: 1,
                decay: 0.03,
                type: 'star',
                glow: 15
            });
        }
        
        setTimeout(() => {
            cardElement.classList.remove('card-drawing');
            this.screenFlash('#00ffcc22', 100);
        }, 300);
    },

    turnTransition(playerName, isYourTurn) {
        const banner = document.createElement('div');
        banner.className = `turn-banner ${isYourTurn ? 'your-turn' : 'opponent-turn'}`;
        banner.innerHTML = `
            <div class="turn-banner-content">
                <span class="turn-banner-icon">${isYourTurn ? '⚔' : '🛡'}</span>
                <span class="turn-banner-text">${isYourTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}</span>
            </div>
        `;
        document.body.appendChild(banner);
        
        this.screenFlash(isYourTurn ? '#00ffcc33' : '#9933ea33', 200);
        
        setTimeout(() => {
            banner.classList.add('exit');
            setTimeout(() => banner.remove(), 500);
        }, 1500);
    },
    
    // ===== VICTORY/DEFEAT =====
    
    victorySequence() {
        this.slowMotion(2000);
        
        setTimeout(() => {
            this.screenFlash('#d4af37', 500);
            this.screenShake(20, 500);
        }, 500);
        
        AnimationHelper.play('crown', null, { isVictory: true });
        
        setTimeout(() => {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            
            for (let wave = 0; wave < 5; wave++) {
                setTimeout(() => {
                    this.burstAt(cx, cy, 80, {
                        colors: ['#d4af37', '#ffffff', '#ffcc00', '#00ffcc'],
                        speed: 15 + wave * 3,
                        size: 12,
                        type: 'star',
                        glow: 30
                    });
                }, wave * 200);
            }
            
            for (let i = 0; i < 100; i++) {
                setTimeout(() => {
                    this.particles.push({
                        x: Math.random() * window.innerWidth,
                        y: -20,
                        vx: (Math.random() - 0.5) * 3,
                        vy: Math.random() * 3 + 2,
                        size: 8 + Math.random() * 8,
                        color: ['#d4af37', '#ff4444', '#00ffcc', '#9933ea', '#ffffff'][Math.floor(Math.random() * 5)],
                        life: 1,
                        decay: 0.005,
                        type: 'circle',
                        gravity: 0.05,
                        glow: 5,
                        rotation: Math.random() * Math.PI * 2
                    });
                }, i * 30);
            }
        }, 1000);
    },
    
    defeatSequence() {
        document.body.classList.add('defeat-effect');
        
        const cracks = document.createElement('div');
        cracks.className = 'screen-cracks';
        cracks.innerHTML = '<svg viewBox="0 0 100 100"><path d="M50,0 L48,30 L30,35 L32,50 L10,55 L35,60 L30,80 L50,75 L55,100" stroke="#fff" stroke-width="0.5" fill="none" opacity="0.5"/></svg>';
        document.body.appendChild(cracks);
        
        AnimationHelper.play('crown', null, { isVictory: false });
        
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 20,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3 - 1,
                size: 10 + Math.random() * 10,
                color: 'rgba(0,0,0,0.5)',
                life: 1,
                decay: 0.01,
                type: 'circle',
                glow: 0
            });
        }
        
        this.screenShake(30, 1000);
        
        setTimeout(() => {
            document.body.classList.remove('defeat-effect');
            cracks.remove();
        }, 3000);
    },
    
    // ===== AMBIENT EFFECTS =====
    
    startBattleAmbience() {
        this.ambientInterval = setInterval(() => {
            // Random cosmic particles
            if (Math.random() > 0.7) {
                this.particles.push({
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    size: 2 + Math.random() * 3,
                    color: ['#d4af37', '#00ffcc', '#9333ea'][Math.floor(Math.random() * 3)],
                    life: 0.5 + Math.random() * 0.5,
                    decay: 0.005,
                    type: 'circle',
                    glow: 10
                });
            }
        }, 100);
    },
    
    stopBattleAmbience() {
        if (this.ambientInterval) {
            clearInterval(this.ambientInterval);
            this.ambientInterval = null;
        }
    },
    
    // ===== DEITY EFFECTS =====
    
    deityAbility(playerIndex, abilityName) {
        const deityCard = document.querySelector(`.player-${playerIndex === 0 ? 'bottom' : 'top'} .deity-card`) ||
                          document.querySelector('.deity-slot');
        
        if (deityCard) {
            const rect = deityCard.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            // God code activation
            this.createRuneCircle(x, y, 'Glow');
            this.screenFlash('#d4af3766', 300);
            this.screenShake(10, 200);
            
            // Ability name display
            const abilityDisplay = document.createElement('div');
            abilityDisplay.className = 'deity-ability-display';
            abilityDisplay.textContent = abilityName;
            abilityDisplay.style.cssText = `left: ${x}px; top: ${y - 80}px;`;
            document.body.appendChild(abilityDisplay);
            
            setTimeout(() => {
                abilityDisplay.classList.add('fade-out');
                setTimeout(() => abilityDisplay.remove(), 500);
            }, 1500);
            
            // Divine particles
            this.burstAt(x, y, 60, {
                colors: ['#d4af37', '#ffffff', '#ffcc00'],
                speed: 10,
                size: 8,
                type: 'star',
                glow: 30
            });
        }
    },
    
    godCodeActivation(playerIndex) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        
        // Full screen divine effect
        this.slowMotion(1500);
        this.screenFlash('#d4af37', 400);
        this.chromaticAberration(1000);
        
        // Divine circle
        const divine = document.createElement('div');
        divine.className = 'god-code-activation';
        document.body.appendChild(divine);
        
        // Massive particle burst
        for (let ring = 0; ring < 8; ring++) {
            setTimeout(() => {
                this.burstAt(cx, cy, 50, {
                    colors: ['#d4af37', '#ffffff'],
                    speed: 5 + ring * 3,
                    size: 10,
                    type: 'star',
                    glow: 40
                });
            }, ring * 100);
        }
        
        setTimeout(() => {
            divine.classList.add('fade-out');
            setTimeout(() => divine.remove(), 500);
        }, 1500);
    },
    
    // ===== CARD DESTRUCTION =====
    
    cardDestroyed(cardElement) {
        const rect = cardElement.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        cardElement.classList.add('destroying');
        
        // Shatter effect
        this.burstAt(x, y, 30, {
            colors: ['#ff4444', '#ff6600', '#333333'],
            speed: 8,
            size: 6,
            gravity: 0.2,
            glow: 10
        });
        
        this.screenShake(8, 200);
    }
};

const TutorialController = {
    active: false,
    currentStep: 0,
    awaitingAction: null,
    
    steps: [
        {
            id: 'welcome',
            title: "Welcome to Essence Crown!",
            text: "Let's play a real match together! I'll guide you through each step. Click CONTINUE to begin.",
            action: 'continue',
            highlight: null
        },
        {
            id: 'show_essence',
            title: "Your Life Total",
            text: "This is your ESSENCE (life). You have 23. If it reaches 0, you lose! Your opponent's Essence is at the top.",
            action: 'continue',
            highlight: '#p1-life-badge',
            arrow: 'left'
        },
        {
            id: 'show_kl',
            title: "Your Energy Resource",
            text: "This is your KUNDALINI (KL). You spend KL to play cards. It starts at 3 and grows each turn (max 13).",
            action: 'continue',
            highlight: '#p1-kl-badge',
            arrow: 'left'
        },
        {
            id: 'show_hand',
            title: "Your Hand",
            text: "These are your cards! Each card has a KL cost in the corner. During Main phase, you can play cards that cost up to your available KL.",
            action: 'continue',
            highlight: '#hand-zone',
            arrow: 'up'
        },
        {
            id: 'advance_to_main',
            title: "Advance to Main Phase",
            text: "Now let's play! Click the 'Next Phase' button to advance from Draw phase to Main phase, where you can play cards.",
            action: 'next_phase',
            highlight: '#btn-next-phase',
            arrow: 'down',
            requiredPhase: 'Main'
        },
        {
            id: 'play_card',
            title: "Play a Card!",
            text: "Great! Now click on any card in your hand that you can afford (cost <= your KL) to play it to the board!",
            action: 'play_card',
            highlight: '#hand-zone',
            arrow: 'up'
        },
        {
            id: 'advance_to_clash',
            title: "Enter Combat!",
            text: "Excellent! Your Avatar is on the board. Now click 'Next Phase' to advance to the CLASH phase where combat happens.",
            action: 'next_phase',
            highlight: '#btn-next-phase',
            arrow: 'down',
            requiredPhase: 'Clash'
        },
        {
            id: 'attack_explain',
            title: "Attack the Opponent!",
            text: "In Clash phase, your Avatars can attack! Click on one of your Avatars in the Avatar Zone to select it as an attacker.",
            action: 'select_attacker',
            highlight: '#p1-avatar-row',
            arrow: 'up'
        },
        {
            id: 'select_target',
            title: "Choose Your Target",
            text: "Now click on the opponent's Deity (their portrait at the top) to deal damage directly to their Essence!",
            action: 'select_target',
            highlight: '#p2-deity-zone',
            arrow: 'down'
        },
        {
            id: 'end_turn',
            title: "End Your Turn",
            text: "Great attack! Now click 'Next Phase' to advance through Twilight and end your turn. The opponent will then take their turn.",
            action: 'next_phase',
            highlight: '#btn-next-phase',
            arrow: 'down',
            requiredPhase: 'Twilight'
        },
        {
            id: 'opponent_turn',
            title: "Opponent's Turn",
            text: "Watch as your opponent takes their turn. When it's your turn again, you'll draw a card and gain +1 max KL!",
            action: 'wait_turn',
            highlight: null
        },
        {
            id: 'complete',
            title: "Tutorial Complete!",
            text: "You've learned the basics! Keep playing to master combat, card abilities, and powerful combos. Good luck, Sovereign!",
            action: 'complete',
            highlight: null
        }
    ],
    
    tutorialDeck: [
        { id: 'tutorial_avatar_1', name: 'Eager Apprentice', type: 'Avatar', cost: 2, attack: 2, health: 3, aspect: 'Glow', effect: 'Basic Avatar for learning.' },
        { id: 'tutorial_avatar_2', name: 'Shadow Scout', type: 'Avatar', cost: 2, attack: 3, health: 2, aspect: 'Void', effect: 'Swift attacker.' },
        { id: 'tutorial_avatar_3', name: 'Temple Guardian', type: 'Avatar', cost: 3, attack: 2, health: 4, aspect: 'Glow', effect: 'Guardian: Must be attacked first.' },
        { id: 'tutorial_spell_1', name: 'Minor Heal', type: 'Spell', cost: 1, aspect: 'Glow', effect: 'Restore 3 Essence.' },
        { id: 'tutorial_avatar_4', name: 'Arcane Student', type: 'Avatar', cost: 1, attack: 1, health: 2, aspect: 'Gray', effect: 'Draw a card when played.' }
    ],
    
    start() {
        this.active = true;
        this.currentStep = 0;
        this.awaitingAction = null;
        
        this.setupTutorialMatch();
        this.showStep();
    },
    
    setupTutorialMatch() {
        const tutorialDeity = {
            id: 'tutorial_deity',
            name: 'Solara, Light Sovereign',
            health: 23,
            image: 'https://via.placeholder.com/200x280/4a1a7a/ffffff?text=Solara',
            aspects: ['Glow'],
            passive: 'Radiance',
            passiveText: 'Glow cards heal +1 extra.',
            godCode: 'Divine Light',
            godCodeText: 'Restore 5 Essence to all allies.',
            godCodeCost: 7
        };
        
        Game.state.selectedDeities = [tutorialDeity, tutorialDeity];
        Game.state.matchMode = 'tutorial';
        Game.state.isAIMatch = true;
        Game.state.aiDifficulty = 'easy';
        
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('solo-overlay').classList.add('hidden');
        
        Game.startGame();
        
        setTimeout(() => {
            const player = Game.state.players[0];
            player.hand = [];
            this.tutorialDeck.forEach(card => {
                player.hand.push({ ...card, instanceId: 'tut_' + Math.random().toString(36).substr(2, 9) });
            });
            Game.renderHand(0);
        }, 500);
    },
    
    showStep() {
        const step = this.steps[this.currentStep];
        if (!step) {
            this.complete();
            return;
        }
        
        this.awaitingAction = step.action;
        
        document.querySelectorAll('.tutorial-highlight-active').forEach(el => el.classList.remove('tutorial-highlight-active'));
        
        let promptHtml = `
            <div id="tutorial-prompt" class="tutorial-prompt">
                <div class="tutorial-prompt-content">
                    <h3>${step.title}</h3>
                    <p>${step.text}</p>
                    <div class="tutorial-prompt-footer">
                        <span class="tutorial-step-indicator">Step ${this.currentStep + 1} of ${this.steps.length}</span>
                        ${step.action === 'continue' ? '<button class="tutorial-continue-btn" onclick="TutorialController.onAction(\'continue\')">CONTINUE</button>' : ''}
                        ${step.action === 'complete' ? '<button class="tutorial-continue-btn" onclick="TutorialController.complete()">FINISH TUTORIAL</button>' : ''}
                        <button class="tutorial-skip-btn" onclick="TutorialController.skip()">Skip Tutorial</button>
                    </div>
                </div>
            </div>
        `;
        
        let existingPrompt = document.getElementById('tutorial-prompt');
        if (existingPrompt) existingPrompt.remove();
        
        document.body.insertAdjacentHTML('beforeend', promptHtml);
        
        if (step.highlight) {
            const target = document.querySelector(step.highlight);
            if (target) {
                target.classList.add('tutorial-highlight-active');
                this.positionPrompt(target, step.arrow);
            }
        } else {
            const prompt = document.getElementById('tutorial-prompt');
            if (prompt) {
                prompt.style.position = 'fixed';
                prompt.style.top = '50%';
                prompt.style.left = '50%';
                prompt.style.transform = 'translate(-50%, -50%)';
            }
        }
    },
    
    positionPrompt(target, arrow) {
        const prompt = document.getElementById('tutorial-prompt');
        if (!prompt || !target) return;
        
        const rect = target.getBoundingClientRect();
        prompt.style.position = 'fixed';
        
        switch(arrow) {
            case 'up':
                prompt.style.top = (rect.bottom + 20) + 'px';
                prompt.style.left = (rect.left + rect.width / 2) + 'px';
                prompt.style.transform = 'translateX(-50%)';
                break;
            case 'down':
                prompt.style.top = (rect.top - 180) + 'px';
                prompt.style.left = (rect.left + rect.width / 2) + 'px';
                prompt.style.transform = 'translateX(-50%)';
                break;
            case 'left':
                prompt.style.top = (rect.top + rect.height / 2) + 'px';
                prompt.style.left = (rect.right + 20) + 'px';
                prompt.style.transform = 'translateY(-50%)';
                break;
            case 'right':
                prompt.style.top = (rect.top + rect.height / 2) + 'px';
                prompt.style.left = (rect.left - 320) + 'px';
                prompt.style.transform = 'translateY(-50%)';
                break;
            default:
                prompt.style.top = '50%';
                prompt.style.left = '50%';
                prompt.style.transform = 'translate(-50%, -50%)';
        }
    },
    
    onAction(action) {
        if (!this.active) return;
        
        const step = this.steps[this.currentStep];
        if (!step) return;
        
        if (action === step.action || action === 'continue') {
            this.advanceStep();
        }
    },
    
    onGameEvent(eventType, data) {
        if (!this.active) return;
        
        const step = this.steps[this.currentStep];
        if (!step) return;
        
        switch(step.action) {
            case 'next_phase':
                if (eventType === 'phase_change') {
                    if (!step.requiredPhase || data.phase === step.requiredPhase) {
                        setTimeout(() => this.advanceStep(), 300);
                    }
                }
                break;
            case 'play_card':
                if (eventType === 'card_played') {
                    setTimeout(() => this.advanceStep(), 500);
                }
                break;
            case 'select_attacker':
                if (eventType === 'attacker_selected') {
                    setTimeout(() => this.advanceStep(), 300);
                }
                break;
            case 'select_target':
                if (eventType === 'attack_declared') {
                    setTimeout(() => this.advanceStep(), 500);
                }
                break;
            case 'wait_turn':
                if (eventType === 'turn_start' && data.playerIndex === 0) {
                    setTimeout(() => this.advanceStep(), 300);
                }
                break;
        }
    },
    
    advanceStep() {
        this.currentStep++;
        if (this.currentStep >= this.steps.length) {
            this.complete();
        } else {
            this.showStep();
        }
    },
    
    complete() {
        this.active = false;
        this.awaitingAction = null;
        
        const prompt = document.getElementById('tutorial-prompt');
        if (prompt) prompt.remove();
        
        document.querySelectorAll('.tutorial-highlight-active').forEach(el => el.classList.remove('tutorial-highlight-active'));
        
        localStorage.setItem('ec-tutorial-seen', 'true');
        
        const shardsEarned = 247;
        CosmeticsManager.addShards(shardsEarned);
        
        Game.log('Tutorial completed! Earned ' + shardsEarned + ' Shards!', 'reward');
        
        const notification = document.createElement('div');
        notification.className = 'tutorial-complete-notification';
        notification.innerHTML = `
            <h2>Tutorial Complete!</h2>
            <p>You earned ${shardsEarned} Shards!</p>
            <p>Continue playing this match or return to menu.</p>
            <button onclick="this.parentElement.remove()">Continue Playing</button>
            <button onclick="TutorialController.returnToMenu()">Return to Menu</button>
        `;
        document.body.appendChild(notification);
    },
    
    skip() {
        this.active = false;
        this.awaitingAction = null;
        
        const prompt = document.getElementById('tutorial-prompt');
        if (prompt) prompt.remove();
        
        document.querySelectorAll('.tutorial-highlight-active').forEach(el => el.classList.remove('tutorial-highlight-active'));
        
        localStorage.setItem('ec-tutorial-seen', 'true');
    },
    
    returnToMenu() {
        document.querySelector('.tutorial-complete-notification')?.remove();
        Game.endMatch();
        document.getElementById('game-board').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
    },
    
    isActionAllowed(action) {
        if (!this.active) return true;
        
        const step = this.steps[this.currentStep];
        if (!step) return true;
        
        if (step.action === 'continue' || step.action === 'complete') return false;
        
        return true;
    }
};

const Tutorial = TutorialController;

const MainMenu = {
    currentScreen: 'main',
    playerData: JSON.parse(localStorage.getItem('ec-player-data') || '{"shards": 0, "name": "Sovereign"}'),
    
    init() {
        this.updateProfile();
        this.initSettings();
        document.getElementById('main-menu').classList.remove('hidden');
    },
    
    updateProfile() {
        const tierInfo = Matchmaking ? Matchmaking.mmoToTier(Matchmaking.playerProfile?.mmr || 1000) : { tier: 'Bronze', level: 'III' };
        document.getElementById('menu-player-name').textContent = this.playerData.name;
        document.getElementById('menu-player-rank').textContent = `${tierInfo.tier} ${tierInfo.level}`;
        document.getElementById('menu-shards').textContent = this.playerData.shards;
    },
    
    selectMode(mode) {
        this.currentScreen = mode;
        document.getElementById('main-menu').classList.add('hidden');
        
        switch(mode) {
            case 'solo':
                document.getElementById('solo-overlay').classList.remove('hidden');
                break;
            case 'campaign':
                CampaignManager.show();
                break;
            case 'multiplayer':
                Game.showQueueSelection();
                break;
            case 'deckbuilder':
                DeckBuilder.show();
                break;
            case 'collection':
                Collection.show();
                break;
            case 'settings':
                this.showSettings();
                break;
            case 'shop':
                this.showShop();
                break;
            case 'learntoplay':
                this.showLearnToPlay();
                break;
        }
    },
    
    back() {
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
        document.getElementById('settings-modal').classList.remove('visible');
        document.getElementById('main-menu').classList.remove('hidden');
        this.currentScreen = 'main';
        AudioManager.play('menu');
    },
    
    show() {
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
        document.getElementById('settings-modal').classList.remove('visible');
        document.getElementById('main-menu').classList.remove('hidden');
        this.updateProfile();
        AudioManager.play('menu');
    },
    
    showTutorial() {
        this.back();
        TutorialController.start();
    },
    
    showCredits() {
        alert('Essence Crown: Shard Wars\n\nDeveloped by SOLEnterprises / SOLARA Storyworks\n\nThank you for playing!');
    },
    
    awardShards(amount) {
        this.playerData.shards += amount;
        localStorage.setItem('ec-player-data', JSON.stringify(this.playerData));
        this.updateProfile();
    },
    
    // ========== SETTINGS FROM MENU ==========
    showSettings() {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('menu-settings-overlay').classList.remove('hidden');
    },
    
    hideSettings() {
        document.getElementById('menu-settings-overlay').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
        this.currentScreen = 'main';
    },
    
    // ========== SHARD SHOP FROM MENU ==========
    showShop() {
        document.getElementById('main-menu').classList.add('hidden');
        CosmeticsManager.init();
        document.getElementById('cosmetics-overlay').classList.remove('hidden');
        document.getElementById('cosmetics-currency').textContent = ShardPath.getCurrency();
        Game.showCosmeticType('cardBack');
    },
    
    hideShop() {
        document.getElementById('cosmetics-overlay').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
        this.currentScreen = 'main';
    },
    
    // ========== LEARN TO PLAY SCREEN ==========
    showLearnToPlay() {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('learn-overlay').classList.remove('hidden');
    },
    
    hideLearnToPlay() {
        document.getElementById('learn-overlay').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
        this.currentScreen = 'main';
    },
    
    showFullRules() {
        document.getElementById('learn-overview').classList.add('hidden');
        document.getElementById('learn-full-rules').classList.remove('hidden');
    },
    
    hideFullRules() {
        document.getElementById('learn-full-rules').classList.add('hidden');
        document.getElementById('learn-overview').classList.remove('hidden');
    },
    
    startTutorialMatch() {
        document.getElementById('learn-overlay').classList.add('hidden');
        CampaignManager.startTutorialBattle();
    },
    
    // ========== SETTINGS TOGGLES ==========
    settings: {
        music: true,
        sfx: true,
        volume: 60,
        animations: true,
        reduceMotion: false,
        lowFx: false,
        textSize: 'medium',
        colorblind: 'off',
        contrast: false
    },
    
    initSettings() {
        const saved = localStorage.getItem('ec-settings');
        if (saved) {
            try {
                Object.assign(this.settings, JSON.parse(saved));
            } catch (e) {}
        }
        this.applySettings();
    },
    
    saveSettings() {
        localStorage.setItem('ec-settings', JSON.stringify(this.settings));
    },
    
    applySettings() {
        document.getElementById('menu-opt-music')?.classList.toggle('active', this.settings.music);
        document.getElementById('menu-opt-sfx')?.classList.toggle('active', this.settings.sfx);
        document.getElementById('menu-opt-animations')?.classList.toggle('active', this.settings.animations);
        document.getElementById('menu-opt-reduce-motion')?.classList.toggle('active', this.settings.reduceMotion);
        document.getElementById('menu-opt-low-fx')?.classList.toggle('active', this.settings.lowFx);
        document.getElementById('menu-opt-contrast')?.classList.toggle('active', this.settings.contrast);
        
        const volumeSlider = document.getElementById('menu-opt-volume');
        if (volumeSlider) volumeSlider.value = this.settings.volume;
        
        const textSizeSelect = document.getElementById('menu-opt-text-size');
        if (textSizeSelect) textSizeSelect.value = this.settings.textSize;
        
        const colorblindSelect = document.getElementById('menu-opt-colorblind');
        if (colorblindSelect) colorblindSelect.value = this.settings.colorblind;
        
        if (typeof GAME_SETTINGS !== 'undefined') {
            GAME_SETTINGS.musicEnabled = this.settings.music;
            GAME_SETTINGS.sfxEnabled = this.settings.sfx;
            GAME_SETTINGS.enableAnimations = this.settings.animations;
            GAME_SETTINGS.musicVolume = this.settings.volume / 100;
            GAME_SETTINGS.sfxVolume = this.settings.volume / 100;
        }
        
        document.body.classList.toggle('reduce-motion', this.settings.reduceMotion);
        document.body.classList.toggle('low-fx', this.settings.lowFx);
        document.body.classList.toggle('high-contrast', this.settings.contrast);
        document.body.dataset.textSize = this.settings.textSize;
        document.body.dataset.colorblind = this.settings.colorblind;
    },
    
    toggleSetting(setting) {
        this.settings[setting] = !this.settings[setting];
        this.applySettings();
        this.saveSettings();
    },
    
    setVolume(value) {
        this.settings.volume = parseInt(value);
        this.applySettings();
        this.saveSettings();
    },
    
    setTextSize(value) {
        this.settings.textSize = value;
        this.applySettings();
        this.saveSettings();
    },
    
    setColorblind(value) {
        this.settings.colorblind = value;
        this.applySettings();
        this.saveSettings();
    }
};

const AIManager = {
    difficulty: 'medium',
    isAITurn: false,
    aiPlayerIndex: 1,
    thinkDelay: 800,
    
    difficultySettings: {
        easy: { playChance: 0.6, attackChance: 0.5, smartTarget: false, thinkTime: 1200 },
        medium: { playChance: 0.8, attackChance: 0.7, smartTarget: true, thinkTime: 800 },
        hard: { playChance: 0.95, attackChance: 0.9, smartTarget: true, thinkTime: 500 },
        boss: { playChance: 1.0, attackChance: 1.0, smartTarget: true, thinkTime: 400 }
    },
    
    startMatch(difficulty) {
        this.difficulty = difficulty;
        this.thinkDelay = this.difficultySettings[difficulty].thinkTime;
        
        document.getElementById('solo-overlay').classList.add('hidden');
        Game.state.matchMode = 'solo';
        Game.state.isAIMatch = true;
        Game.state.aiDifficulty = difficulty;
        Game.showDeitySelection(0);
    },
    
    selectAIDeity() {
        const deities = getDeities();
        const aiDeity = deities[Math.floor(Math.random() * deities.length)];
        Game.state.selectedDeities[1] = aiDeity;
        Game.log(`AI chose ${aiDeity.name}`, 'phase');
    },
    
    takeTurn() {
        if (!Game.state.isAIMatch || Game.state.currentPlayer !== this.aiPlayerIndex) return;
        if (Game.state.gameOver) return;
        
        this.isAITurn = true;
        const settings = this.difficultySettings[this.difficulty];
        
        setTimeout(() => this.processPhase(settings), this.thinkDelay);
    },
    
    processPhase(settings) {
        if (Game.state.gameOver || !this.isAITurn) return;
        
        const phase = Game.state.currentPhase;
        const player = Game.state.players[this.aiPlayerIndex];
        
        switch(phase) {
            case 'dawn':
            case 'draw':
                setTimeout(() => Game.nextPhase(), 300);
                break;
                
            case 'main':
                this.triggerHint('main_phase');
                this.playCards(settings, () => {
                    setTimeout(() => Game.nextPhase(), 500);
                });
                break;
                
            case 'clash':
                this.declareAttacks(settings, () => {
                    setTimeout(() => Game.nextPhase(), 500);
                });
                break;
                
            case 'twilight':
                setTimeout(() => Game.endTurn(), 500);
                this.isAITurn = false;
                break;
        }
    },
    
    playCards(settings, callback) {
        const player = Game.state.players[this.aiPlayerIndex];
        const playableCards = player.hand.filter(c => c.cost <= player.klCurrent && c.type !== 'Deity');
        
        if (playableCards.length > 0 && Math.random() < settings.playChance) {
            const card = this.chooseBestCard(playableCards, settings);
            if (card) {
                Game.log(`AI plays ${card.name}`, 'action');
                Game.playCard(card, this.aiPlayerIndex);
                
                setTimeout(() => this.playCards(settings, callback), this.thinkDelay);
                return;
            }
        }
        callback();
    },
    
    chooseBestCard(cards, settings) {
        if (!settings.smartTarget) {
            return cards[Math.floor(Math.random() * cards.length)];
        }
        
        const avatars = cards.filter(c => c.type === 'Avatar');
        const spells = cards.filter(c => c.type === 'Spell');
        
        const player = Game.state.players[this.aiPlayerIndex];
        if (player.avatarRow.length < 3 && avatars.length > 0) {
            return avatars.reduce((best, c) => (!best || c.attack > best.attack) ? c : best, null);
        }
        
        if (spells.length > 0) {
            return spells[0];
        }
        
        return cards[0];
    },
    
    declareAttacks(settings, callback) {
        const player = Game.state.players[this.aiPlayerIndex];
        const opponent = Game.state.players[1 - this.aiPlayerIndex];
        
        const attackers = player.avatarRow.filter(c => !c.tapped && c.attack > 0);
        
        if (attackers.length === 0 || Math.random() > settings.attackChance) {
            callback();
            return;
        }
        
        this.executeAttacks(attackers, opponent, settings, callback);
    },
    
    executeAttacks(attackers, opponent, settings, callback) {
        if (attackers.length === 0) {
            callback();
            return;
        }
        
        const attacker = attackers.shift();
        const targets = opponent.avatarRow.filter(c => c.healthCurrent > 0);
        
        let target = null;
        if (targets.length > 0 && (settings.smartTarget || Math.random() > 0.3)) {
            target = settings.smartTarget 
                ? targets.reduce((best, t) => (!best || t.healthCurrent < best.healthCurrent) ? t : best, null)
                : targets[Math.floor(Math.random() * targets.length)];
        }
        
        Game.state.combat.selectedAttacker = attacker;
        Game.state.combat.selectedTarget = target;
        Game.state.combat.attackerPlayer = this.aiPlayerIndex;
        
        Game.log(`AI attacks with ${attacker.name}${target ? ' targeting ' + target.name : ' directly'}`, 'damage');
        
        setTimeout(() => {
            Game.resolveCombat();
            setTimeout(() => this.executeAttacks(attackers, opponent, settings, callback), 600);
        }, 400);
    },
    
    onMatchEnd(won) {
        const rewards = { easy: 232, medium: 247, hard: 272, boss: 322 };
        if (won) {
            MainMenu.awardShards(rewards[this.difficulty] || 247);
        }
    }
};

const BossDecks = {
    // Pre-built boss decks - each boss has their own themed deck
    1: ['EC-057', 'EC-058', 'EC-059', 'EC-060', 'EC-001', 'EC-002', 'EC-003', 'EC-010', 'EC-011', 'EC-012', 'EC-013', 'EC-014', 'EC-015', 'EC-016', 'EC-017', 'EC-018', 'EC-019', 'EC-020', 'EC-021', 'EC-022', 'EC-023', 'EC-024', 'EC-025', 'EC-026', 'EC-027', 'EC-028', 'EC-029', 'EC-030', 'EC-031', 'EC-032'],
    2: ['EC-061', 'EC-062', 'EC-063', 'EC-064', 'EC-065', 'EC-066', 'EC-012', 'EC-013', 'EC-014', 'EC-015', 'EC-016', 'EC-017', 'EC-018', 'EC-019', 'EC-020', 'EC-021', 'EC-022', 'EC-023', 'EC-024', 'EC-025', 'EC-026', 'EC-027', 'EC-028', 'EC-029', 'EC-030', 'EC-031', 'EC-032', 'EC-033', 'EC-034', 'EC-035'],
    3: ['EC-067', 'EC-068', 'EC-069', 'EC-070', 'EC-071', 'EC-072', 'EC-020', 'EC-021', 'EC-022', 'EC-023', 'EC-024', 'EC-025', 'EC-026', 'EC-027', 'EC-028', 'EC-029', 'EC-030', 'EC-031', 'EC-032', 'EC-033', 'EC-034', 'EC-035', 'EC-036', 'EC-037', 'EC-038', 'EC-039', 'EC-040', 'EC-041', 'EC-042', 'EC-043'],
    4: ['EC-073', 'EC-074', 'EC-075', 'EC-076', 'EC-077', 'EC-078', 'EC-030', 'EC-031', 'EC-032', 'EC-033', 'EC-034', 'EC-035', 'EC-036', 'EC-037', 'EC-038', 'EC-039', 'EC-040', 'EC-041', 'EC-042', 'EC-043', 'EC-044', 'EC-045', 'EC-046', 'EC-047', 'EC-048', 'EC-049', 'EC-050', 'EC-051', 'EC-052', 'EC-053'],
    5: ['EC-079', 'EC-080', 'EC-081', 'EC-082', 'EC-083', 'EC-084', 'EC-040', 'EC-041', 'EC-042', 'EC-043', 'EC-044', 'EC-045', 'EC-046', 'EC-047', 'EC-048', 'EC-049', 'EC-050', 'EC-051', 'EC-052', 'EC-053', 'EC-054', 'EC-055', 'EC-056', 'EC-057', 'EC-058', 'EC-059', 'EC-060', 'EC-061', 'EC-062', 'EC-063'],
    6: ['EC-085', 'EC-086', 'EC-087', 'EC-088', 'EC-089', 'EC-090', 'EC-050', 'EC-051', 'EC-052', 'EC-053', 'EC-054', 'EC-055', 'EC-056', 'EC-057', 'EC-058', 'EC-059', 'EC-060', 'EC-061', 'EC-062', 'EC-063', 'EC-064', 'EC-065', 'EC-066', 'EC-067', 'EC-068', 'EC-069', 'EC-070', 'EC-071', 'EC-072', 'EC-073'],
    7: ['EC-091', 'EC-092', 'EC-093', 'EC-094', 'EC-095', 'EC-096', 'EC-060', 'EC-061', 'EC-062', 'EC-063', 'EC-064', 'EC-065', 'EC-066', 'EC-067', 'EC-068', 'EC-069', 'EC-070', 'EC-071', 'EC-072', 'EC-073', 'EC-074', 'EC-075', 'EC-076', 'EC-077', 'EC-078', 'EC-079', 'EC-080', 'EC-081', 'EC-082', 'EC-083'],
    8: ['EC-097', 'EC-098', 'EC-099', 'EC-100', 'EC-101', 'EC-102', 'EC-070', 'EC-071', 'EC-072', 'EC-073', 'EC-074', 'EC-075', 'EC-076', 'EC-077', 'EC-078', 'EC-079', 'EC-080', 'EC-081', 'EC-082', 'EC-083', 'EC-084', 'EC-085', 'EC-086', 'EC-087', 'EC-088', 'EC-089', 'EC-090', 'EC-091', 'EC-092', 'EC-093'],
    9: ['EC-103', 'EC-104', 'EC-105', 'EC-106', 'EC-107', 'EC-108', 'EC-080', 'EC-081', 'EC-082', 'EC-083', 'EC-084', 'EC-085', 'EC-086', 'EC-087', 'EC-088', 'EC-089', 'EC-090', 'EC-091', 'EC-092', 'EC-093', 'EC-094', 'EC-095', 'EC-096', 'EC-097', 'EC-098', 'EC-099', 'EC-100', 'EC-101', 'EC-102', 'EC-103'],
    10: ['EC-109', 'EC-110', 'EC-111', 'EC-112', 'EC-113', 'EC-114', 'EC-090', 'EC-091', 'EC-092', 'EC-093', 'EC-094', 'EC-095', 'EC-096', 'EC-097', 'EC-098', 'EC-099', 'EC-100', 'EC-101', 'EC-102', 'EC-103', 'EC-104', 'EC-105', 'EC-106', 'EC-107', 'EC-108', 'EC-109', 'EC-110', 'EC-111', 'EC-112', 'EC-113']
};

// ===== STORY CAMPAIGN DATA =====
const CampaignStory = {
    title: "Shards of the Second Sun",
    subtitle: "A Story Campaign",
    prologue: {
        title: "Prologue: The First Shard",
        text: `In the beginning, there was only the Crown — an infinite wellspring of Essence that held all realities together. But the Crown was shattered in the Primordial War, its fragments scattered across countless Domains as crystallized power: the Shards.

You awaken in the ruins of the Second Sun, the last bastion of light in a universe consumed by the Shard Wars. A presence stirs within you — the echo of a fallen Deity, whispering secrets of power long forgotten.

"Shardkeeper," the voice calls. "You are the last hope. The Essence Crown can be reformed, but only by one who masters the art of the Shard Duel. Let me guide your first steps..."

Your journey to claim the Crown begins now.`
    },
    
    acts: [
        {
            id: 1,
            name: "Act I: Awakening of the Shards",
            summary: "Your journey begins in the ruins of the Second Sun, where you must prove your worth as a Shardkeeper and learn the ancient art of Shard Dueling.",
            chapters: [
                {
                    id: 1,
                    title: "The First Light",
                    domains: ["Second Sun"],
                    bossName: "The Initiate",
                    bossDeity: "EC-001",
                    difficulty: 1,
                    portrait: "🧙",
                    prelude: "The ruins of the Second Sun stretch before you, bathed in eternal twilight. A hooded figure awaits at the Temple of First Light.",
                    cutscene: `The air shimmers with residual Essence as you approach the ancient temple. Crystalline shards embedded in the walls pulse with a faint, rhythmic glow — the heartbeat of a dying domain.

"So, another seeker comes," the hooded figure speaks, voice like wind through hollow bones. "I am the Initiate, guardian of the First Gate. Many have come seeking the Crown's power, but few understand its burden."

He raises a weathered hand, and three Shards materialize in the air between you — Avatar, Spell, and Domain, the fundamental trinity of power.

"Before you can walk the Path of Shards, you must prove you understand the dance. I will be gentle... at first."

The Initiate's eyes flash with ancient power as he draws his opening hand. "Show me your resolve, Shardkeeper!"`,
                    victory: `The Initiate kneels, his form flickering like a dying flame. "Well fought... You have the spark of a true Sovereign within you."

He presses a glowing Shard into your palm. "This is the Shard of Awakening. It will guide you to the next gate. But be warned — the path ahead grows darker, and not all guardians will be as merciful as I."

As he fades into light, his final words echo: "Seek the Shadow Disciple in the Nullgrid. There, your true trials begin..."`,
                    rewards: { shards: 272, title: "Awakened One" },
                    ability: { name: "Mentor's Guidance", desc: "+1 card draw on turn 3", trigger: "turn", turn: 3, effect: "draw" }
                },
                {
                    id: 2,
                    title: "Shadows of the Void",
                    domains: ["Nullgrid"],
                    bossName: "Shadow Disciple",
                    bossDeity: "EC-002",
                    difficulty: 2,
                    portrait: "👤",
                    prelude: "The Nullgrid — a realm where light itself fears to tread. Here, the Void's servants hunt those who carry the Crown's spark.",
                    cutscene: `The transition from Second Sun to Nullgrid is like plunging into frozen darkness. Your Shard of Awakening pulses erratically, struggling against the oppressive emptiness.

"I have been watching you, little flame." The voice comes from everywhere and nowhere. "The shadows whisper your name across the Domains."

A figure materializes from the darkness — the Shadow Disciple, wrapped in robes that seem woven from night itself. Their eyes are twin points of absolute blackness.

"You carry the Initiate's blessing, but here in the Nullgrid, light is merely a memory waiting to die." They gesture, and shadows coalesce into cards that float around them like predatory birds.

"I am the Second Gate. To pass, you must prove that your light can survive the crushing weight of the Void. Show me... if you can endure the darkness."

The Nullgrid itself seems to lean in, hungry and watching.`,
                    victory: `The Shadow Disciple staggers as their form begins to unravel at the edges. "Impossible... Your light burns too bright for the Void to consume."

They offer you a fragment of crystallized darkness — a Shard that pulses with anti-light. "Take this Void Shard. You will need its power for what lies ahead."

"The Balance Keeper awaits in the Gray Court. But be warned, young Shardkeeper — the Gray does not care for light OR darkness. It consumes both equally."

As the shadows release you, you feel stronger. The Void has tested you and found you worthy.`,
                    rewards: { shards: 297, title: "Void Touched" },
                    ability: { name: "Shadow Step", desc: "First Avatar gains Stealth", trigger: "summon", effect: "stealth" }
                },
                {
                    id: 3,
                    title: "The Gray Judgment",
                    domains: ["Gray Court"],
                    bossName: "Balance Keeper",
                    bossDeity: "EC-036",
                    difficulty: 3,
                    portrait: "⚖",
                    prelude: "The Gray Court exists between all extremes — neither light nor dark, neither living nor dead. Here, the Balance Keeper judges all who seek the Crown.",
                    cutscene: `The Gray Court is a realm of perfect equilibrium. Every color fades to ash, every sound muffles to whispers. You walk a path of floating gray stones suspended in endless mist.

At the center of the Court stands a figure of perfect symmetry — the Balance Keeper, their form shifting between masculine and feminine, young and old, mortal and divine.

"Light and Dark, Creation and Destruction, Life and Death — you carry shards of both within you." Their voice resonates on multiple frequencies simultaneously. "But the Crown demands BALANCE, not just power."

They raise both hands, and the mist forms into a massive scale. "I am the Arbiter of the Third Gate. You have impressed the servants of Sun and Void, but neither truly tests your equilibrium."

The scales tip violently as the Balance Keeper draws their opening hand. "Let us see if you can maintain harmony under pressure. For in the Gray, extremism is the only sin!"`,
                    victory: `The Balance Keeper nods, the scales behind them settling into perfect alignment. "You do not fight with pure aggression or pure defense. You adapt. You balance. This is... acceptable."

They present you with a gray crystal — the Shard of Equilibrium, neither warm nor cold, neither light nor dark.

"The first Act of your journey nears its end, but the final trial of Awakening awaits. The Beast Warden guards the gate to New Earth, and they are... less philosophical than I."

A rare smile crosses their shifting face. "You may survive this war after all, Shardkeeper."`,
                    rewards: { shards: 322, title: "Gray Touched" },
                    ability: { name: "Equilibrium", desc: "Heals 2 when taking damage", trigger: "damage", effect: "heal", amount: 2 }
                },
                {
                    id: 4,
                    title: "Call of the Wild",
                    domains: ["New Earth"],
                    bossName: "Beast Warden",
                    bossDeity: "EC-037",
                    difficulty: 4,
                    portrait: "🦁",
                    prelude: "New Earth — where the primal forces of creation run wild and untamed. The Beast Warden commands all creatures born of pure instinct.",
                    cutscene: `The portal to New Earth explodes with life — vines grip your legs, birds screech warnings, and the ground itself pulses with vital energy. This is creation unchained, nature at its most magnificent and terrifying.

A massive figure emerges from the treeline — the Beast Warden, their body a fusion of every apex predator that ever existed. Lion's mane, eagle's eyes, serpent's scales, bear's strength.

"FINALLY! A worthy prey approaches!" Their voice is a thunderous roar that sets the jungle trembling. "The others spoke of philosophy and balance. BAH! The only truth is the hunt!"

Creatures of every size and shape emerge behind them — an army of beasts awaiting their master's command.

"I am the FOURTH Gate, little Shardkeeper! Not a gatekeeper who tests with words, but a HUNTER who tests with FANGS!" They drop to all fours, muscles coiling with predatory tension.

"RUN if you wish — it only makes the chase sweeter. FIGHT if you dare — and pray you can match the fury of the WILD!"

The beasts howl in unison as battle commences.`,
                    victory: `The Beast Warden throws back their head and LAUGHS — a sound of pure, joyous respect.

"HA! You fight like a cornered wolf! No fear, no hesitation, only the will to SURVIVE!" They clap a massive paw on your shoulder, nearly knocking you down.

"You have earned this, little hunter." They press a Shard pulsing with primal energy into your hands — the Shard of the Wild.

"Act One ends here, but your real journey begins. The machine-minds of Act Two will test you in ways even I cannot imagine. But remember..." Their eyes gleam with feral wisdom.

"No matter how complex the battle becomes, never forget the simple truth: the strongest will ALWAYS survives."

The beasts bow as you pass, recognizing you as one of their own.`,
                    rewards: { shards: 347, title: "Wild Heart" },
                    ability: { name: "Pack Leader", desc: "Avatars +1 Attack when 3+ on field", trigger: "summon", effect: "buff", threshold: 3 }
                }
            ]
        },
        {
            id: 2,
            name: "Act II: Storm of the Machine",
            summary: "Having proven yourself against nature and shadow, you must now face the cold logic of the machine realms, where emotion is weakness and calculation is power.",
            chapters: [
                {
                    id: 5,
                    title: "The Gear Awakens",
                    domains: ["Crownline"],
                    bossName: "Gear Conductor",
                    bossDeity: "EC-038",
                    difficulty: 5,
                    portrait: "⚙",
                    prelude: "Crownline — where organic life gave way to perfect mechanical order. The Gear Conductor orchestrates all processes with inhuman precision.",
                    cutscene: `The transition to Crownline is jarring — organic sounds fade, replaced by the rhythmic hum of infinite machinery. Gears the size of mountains turn overhead, and rivers of molten metal flow through channels carved with mathematical precision.

A figure descends from the clockwork heavens — the Gear Conductor, their body a masterwork of brass and crystal, every joint and limb moving with calculated perfection.

"SCANNING... ORGANIC LIFEFORM DETECTED." Their voice is synthesized from a thousand harmonics. "EMOTIONAL PATTERNS: CHAOTIC. DECISION MATRICES: SUBOPTIMAL. THREAT ASSESSMENT: CALCULATING..."

Their eyes flash with cascading data. "CONCLUSION: YOU ARE INEFFICIENT, ORGANIC. YOUR 'INSTINCTS' AND 'FEELINGS' ARE EVOLUTIONARY ARTIFACTS. THE CROWN REQUIRES PERFECTION."

Gears whir and click as they assume a combat stance that seems designed by committee.

"INITIATING EFFICIENCY PROTOCOL. PREPARE FOR SYSTEMATIC ELIMINATION, SHARDKEEPER. YOUR VARIABLES WILL BE... OPTIMIZED."`,
                    victory: `The Gear Conductor's systems spark and stutter. "ERROR... ERROR... UNPREDICTABLE VARIABLES EXCEEDED PARAMETERS..."

Their mechanical face attempts something like surprise. "ANALYSIS COMPLETE: ORGANIC ADAPTABILITY EXCEEDS MACHINE OPTIMIZATION IN CHAOTIC SCENARIOS."

A gear-shaped Shard ejects from their chest — the Shard of Precision. "RECALIBRATING... Perhaps efficiency and instinct can... coexist."

"WARNING: PULSE COMMANDER IN SECTOR 7 HAS DETECTED YOUR PROGRESS. THEY ARE... LESS INTERESTED IN COEXISTENCE. RECOMMENDATION: PREPARE FOR ENERGIZED COMBAT."

For the first time, something like respect flickers in their crystalline eyes.`,
                    rewards: { shards: 372, title: "Gear-Touched" },
                    ability: { name: "Overdrive", desc: "+1 KL every 2 turns", trigger: "turn", interval: 2, effect: "kl" }
                },
                {
                    id: 6,
                    title: "Storm Protocol",
                    domains: ["Crownline", "Astral Rift"],
                    bossName: "Pulse Commander",
                    bossDeity: "EC-039",
                    difficulty: 6,
                    portrait: "⚡",
                    prelude: "The Pulse Commander controls the energy grid that powers all machine life. To challenge them is to face lightning incarnate.",
                    cutscene: `The air crackles with static electricity as you enter the Energy Nexus. Lightning arcs between towering spires, and the very atmosphere seems to vibrate with contained power.

A figure made entirely of living electricity materializes before you — the Pulse Commander, their form shifting between solid and pure energy.

"FEEL that?" Their voice sounds like a thousand thunderclaps harmonized. "That's POWER, Shardkeeper! Not the weak trickle of organic bioelectricity, but PURE, UNLIMITED ENERGY!"

Lightning dances around them in complex patterns. "The Gear Conductor was about precision. I am about FORCE! Raw, unstoppable, ELECTRIFYING force!"

They raise their hands, and the entire grid responds — every light intensifies, every machine hums louder.

"You've fought shadow and beast, machine and balance. But have you ever fought a STORM? I am the Sixth Gate, and I will teach you what happens when you challenge LIGHTNING ITSELF!"

The first bolt descends before they finish speaking.`,
                    victory: `The Pulse Commander disperses into a shower of harmless sparks, then reforms, laughing with genuine delight.

"INCREDIBLE! You grounded my lightning! You ABSORBED my surge!" They offer you a crackling Shard — the Shard of the Storm.

"I haven't felt resistance like that since the Primordial War! You're no ordinary organic, Shardkeeper."

Their form flickers with what might be concern. "But the one who awaits you next... the Eclipse Herald... they are something else entirely. Neither machine nor organic, neither light nor dark. They are the TWILIGHT, and twilight consumes ALL."

Lightning crackles around you one last time — a farewell salute from one warrior to another.`,
                    rewards: { shards: 397, title: "Storm Rider" },
                    ability: { name: "Chain Lightning", desc: "1 damage to all when casting spells", trigger: "spell", effect: "aoe", damage: 1 }
                }
            ]
        },
        {
            id: 3,
            name: "Act III: Twilight of the Crown",
            summary: "The final trials await. Face the Eclipse Herald, the Void Empress, and ultimately challenge the Crownshatter Sovereign himself — Demon Lord Kaixu.",
            chapters: [
                {
                    id: 7,
                    title: "The Eternal Eclipse",
                    domains: ["Shattered Sun", "Nullgrid"],
                    bossName: "Eclipse Herald",
                    bossDeity: "EC-040",
                    difficulty: 7,
                    portrait: "🌑",
                    prelude: "Where the Second Sun and Nullgrid collide exists the Eternal Eclipse — a realm of perpetual twilight where neither light nor dark holds dominion.",
                    cutscene: `The boundary between realms dissolves as you enter the Eclipse Zone. Half the sky burns with the dying light of the Second Sun; the other half churns with the absolute darkness of the Void. Where they meet, reality itself seems uncertain.

A figure emerges from the twilight — the Eclipse Herald, their form shifting between radiant and shadow with each heartbeat.

"Beautiful, isn't it?" Their voice carries harmonics of both light and dark. "This is what the Crown truly represents — not the triumph of one extreme, but the eternal dance between them."

They gesture, and the eclipse intensifies. "The others tested aspects of your power. I test your ADAPTABILITY. Can you fight in a world where the rules constantly shift?"

Light surges — they become radiant, burning with solar fury. Then darkness swells — they fade to shadow, cold and calculating.

"I am the Seventh Gate, the Herald of the Eternal Eclipse. Face me, and learn the truth: in the Shard Wars, only those who embrace CHANGE can survive!"`,
                    victory: `The Eclipse Herald's form stabilizes, merging light and dark into a perfect twilight gray.

"You... you embraced both. When I shifted, you adapted. When I changed, you evolved." They present the Shard of Twilight, half gold, half obsidian.

"The Void Empress awaits in the heart of the Nullgrid. She is... not as philosophical as I. Pure darkness, pure hunger, pure VOID."

Their twilight eyes meet yours. "But if you can dance with the eclipse, perhaps you can survive even her embrace. Go, Shardkeeper. The final act of your journey begins."`,
                    rewards: { shards: 422, title: "Twilight Walker" },
                    ability: { name: "Eclipse", desc: "Switches aspect every 3 turns", trigger: "turn", interval: 3, effect: "aspect_shift" }
                },
                {
                    id: 8,
                    title: "Heart of the Void",
                    domains: ["Sanctuary Void"],
                    bossName: "Void Empress",
                    bossDeity: "EC-041",
                    difficulty: 8,
                    portrait: "👸",
                    prelude: "The Sanctuary Void — the absolute center of nothingness, where the Void Empress has ruled since before time had meaning.",
                    cutscene: `There is no transition. One moment you exist; the next, you float in absolute nothing. No up, no down, no light, no sound. Just... emptiness.

Then SHE appears. The Void Empress manifests as a negative image of reality — a woman-shaped hole in existence itself, crowned with crystallized nothing.

"Kneel." Her voice doesn't come from anywhere — it simply EXISTS in your mind. "All things kneel before the Empress of Nothing."

Your Shards pulse with desperate energy, fighting to maintain your existence against her overwhelming presence.

"You have gathered fragments of power across the Domains. Light, Dark, Gray, Wild, Machine, Storm, Twilight... but at the heart of all things is NOTHING." She raises a hand, and you feel your very essence beginning to unravel.

"I am the Eighth Gate — the final test before you face the Crownshatter himself. Prove to me that your existence has MEANING, or be consumed by the beautiful emptiness of the Void."`,
                    victory: `For the first time in eons, the Void Empress feels surprise. "You... you refused to become nothing. You insisted on BEING."

Her form flickers with something almost like admiration. "In all my millennia, only one other resisted the Void so completely. And he became... something terrible."

She offers you the Shard of the Void — absolute darkness crystallized into power.

"Demon Lord Kaixu, the Crownshatter Sovereign. He was once like you — a Shardkeeper seeking the Crown. But he chose to SHATTER rather than claim." Her voice carries ancient sorrow.

"He waits in the Shattered Crown Domain. If you fall, the Shard Wars continue forever. But if you triumph..." A rare smile crosses her void-face. "Perhaps the Crown can finally be reformed."`,
                    rewards: { shards: 472, title: "Void Sovereign" },
                    ability: { name: "Void Drain", desc: "Steals 1 Essence on Deity hit", trigger: "deity_damage", effect: "drain", amount: 1 }
                },
                {
                    id: 9,
                    title: "The Crownshatter",
                    domains: ["Shattered Crown"],
                    bossName: "Demon Lord Kaixu",
                    bossDeity: "EC-069",
                    difficulty: 9,
                    portrait: "👑",
                    prelude: "The Shattered Crown Domain — where the original Crown was broken eons ago. Here, Demon Lord Kaixu awaits, eternal and terrible.",
                    cutscene: `The Shattered Crown Domain is a graveyard of possibilities. Fragments of the original Crown float in an endless void, each piece pulsing with the power to reshape reality.

And there, at the center of it all, sits KAIXU.

The Demon Lord rises from a throne carved from Crown fragments. His form is impossibly magnificent — part deity, part demon, all sovereign. Power radiates from him like heat from a star.

"So... the little Shardkeeper finally arrives." His voice carries the weight of eons. "I have watched your journey with great interest. You defeated my servants. You gathered the Shards. You even impressed the Void Empress herself."

He descends from his throne, each step cracking reality around him.

"But do you understand WHY I shattered the Crown? It was too dangerous to exist whole. Too much power for any single being. I SAVED the universe by breaking it!"

His eyes blaze with ancient fury. "And now you seek to undo my work? To reform what I sacrificed EVERYTHING to destroy?"

He draws his cards, and each one burns with dark majesty.

"I am Demon Lord Kaixu, the CROWNSHATTER SOVEREIGN! If you want the Crown, you must first SHATTER ME! And that, little Shardkeeper... is IMPOSSIBLE!"`,
                    victory: `Kaixu falls to one knee, his crown of shards cracking. For the first time in millennia, he looks... at peace.

"You... you actually did it. You defeated the Crownshatter." He laughs — not with malice, but with genuine relief.

"I have guarded these shards for so long, terrified of what would happen if someone unworthy claimed them. But you..." He offers you the Crown Shard — the largest fragment of all.

"You have proven yourself worthy of the burden I have carried. The Essence Crown can be reformed — but only by one who has mastered ALL aspects of the Shards."

He rises, his form beginning to fade. "One trial remains, Shardkeeper. The Crown Arbiter — the original keeper of the Crown — awaits at the heart of reality itself. Defeat them, and the Crown is yours."

"But remember..." His final words echo across dimensions. "The Crown is not power. The Crown is RESPONSIBILITY."`,
                    rewards: { shards: 522, title: "Crownshatter's Bane" },
                    ability: { name: "Shard War", desc: "Heals 3 every 4 turns, +2 Attack", trigger: "turn", interval: 4, effect: "divine" }
                },
                {
                    id: 10,
                    title: "The Essence Crown",
                    domains: ["Crown Nexus"],
                    bossName: "Crown Arbiter",
                    bossDeity: "EC-036",
                    difficulty: 10,
                    portrait: "💎",
                    prelude: "The Crown Nexus — the center of all realities, where the Essence Crown was first forged and can finally be reformed.",
                    cutscene: `The Crown Nexus is beyond description. Every Domain, every reality, every possibility converges in this impossible space. And at its center hovers the incomplete Essence Crown, waiting to be made whole.

Before it stands the Crown Arbiter — an entity older than time itself, formed from pure crystallized Essence.

"Shardkeeper. You have come far." Their voice resonates on every frequency of existence. "You have gathered the Shards. You have defeated Kaixu. You stand at the threshold of ultimate power."

The Crown fragments swirl around you both, hungry to be reunited.

"But I am the final test. Not a gatekeeper — the ORIGINAL keeper. I was there when the Crown was first forged, and I was there when Kaixu shattered it."

They assume a combat stance that seems to draw power from reality itself.

"If you defeat me, the Crown is yours. You will become the new Sovereign of Essence, with power over all Domains, all realities, all existence."

Their eyes blaze with the light of creation itself.

"But if you are UNWORTHY... the Crown will shatter again, and the Shard Wars will continue for another eternity. THIS IS YOUR FINAL TRIAL, SHARDKEEPER! PROVE YOUR WORTH!"`,
                    victory: `The Crown Arbiter doesn't fall — they bow.

"At last... a true Sovereign emerges."

The Crown fragments swirl around you, drawn by an irresistible force. One by one, they merge — Light, Dark, Gray, Wild, Machine, Storm, Twilight, Void, Shatter, Crown — forming something whole, something perfect.

THE ESSENCE CROWN.

It settles upon your brow, and for one infinite moment, you understand EVERYTHING. Every reality, every possibility, every soul.

"Go forth, Sovereign of Essence," the Arbiter speaks. "The Crown is yours. The Shard Wars are ended. A new age begins."

The Crown Nexus ripples with your power as you take your first steps as the TRUE ruler of all Domains.

But even as you celebrate, you sense it — new challenges on distant horizons, new threats gathering in the shadows between realities.

The Essence Crown is yours. Now you must prove worthy of wearing it.

TO BE CONTINUED...`,
                    rewards: { shards: 722, title: "Essence Sovereign" },
                    ability: { name: "Crown's Judgment", desc: "All abilities active, +3 Essence", trigger: "start", effect: "ultimate" },
                    isFinale: true
                }
            ]
        }
    ]
};

const CampaignManager = {
    progress: JSON.parse(localStorage.getItem('ec-campaign-progress') || '{"completed": [], "current": 0}'),
    activeBoss: null,
    dialogueQueue: [],
    story: CampaignStory,
    
    getAllChapters() {
        const chapters = [];
        this.story.acts.forEach(act => {
            act.chapters.forEach(ch => {
                chapters.push({
                    ...ch,
                    actId: act.id,
                    actName: act.name
                });
            });
        });
        return chapters;
    },
    
    bosses: [
        { 
            id: 1, name: 'The Initiate', deity: 'EC-001', difficulty: 'easy', reward: 272, 
            desc: 'Your journey begins here', portrait: '🧙',
            intro: ["So, another challenger approaches...", "I am but a humble guardian of the first gate.", "Show me your resolve, Shardkeeper!"],
            taunt: ["Is that all you have?", "The Crown demands more!", "Your essence wavers..."],
            defeat: ["Well fought... The path ahead grows darker.", "You have earned your passage."],
            ability: { name: 'Mentor\'s Guidance', desc: '+1 card draw on turn 3', trigger: 'turn', turn: 3, effect: 'draw' }
        },
        { 
            id: 2, name: 'Shadow Disciple', deity: 'EC-002', difficulty: 'easy', reward: 297, 
            desc: 'A servant of the Void', portrait: '👤',
            intro: ["The shadows whisper your name...", "I have seen your fate in the darkness.", "Come, embrace the Void!"],
            taunt: ["The darkness consumes!", "Your light fades...", "Void hungers!"],
            defeat: ["The shadows... recede...", "Perhaps you are worthy of the Crown after all."],
            ability: { name: 'Shadow Step', desc: 'Gains Stealth on first Avatar', trigger: 'summon', effect: 'stealth' }
        },
        { 
            id: 3, name: 'Balance Keeper', deity: 'EC-036', difficulty: 'medium', reward: 322, 
            desc: 'Guardian of Gray', portrait: '⚖',
            intro: ["Balance must be maintained.", "Neither light nor dark shall prevail here.", "I judge all who seek the Crown!"],
            taunt: ["The scales tip against you!", "Equilibrium demands payment!", "Gray consumes both extremes!"],
            defeat: ["Balance... is restored through you.", "The Gray acknowledges your strength."],
            ability: { name: 'Equilibrium', desc: 'Heals 2 when taking damage', trigger: 'damage', effect: 'heal', amount: 2 }
        },
        { 
            id: 4, name: 'Beast Warden', deity: 'EC-037', difficulty: 'medium', reward: 322, 
            desc: 'Master of creatures', portrait: '🦁',
            intro: ["The wild ones answer my call!", "Nature itself rises against you!", "Feel the fury of the untamed!"],
            taunt: ["The pack grows stronger!", "Wild instincts prevail!", "Tooth and claw!"],
            defeat: ["The beasts... bow to a new master.", "Your spirit is truly wild."],
            ability: { name: 'Pack Leader', desc: 'Avatars gain +1 Attack when 3+ on field', trigger: 'summon', effect: 'buff', threshold: 3 }
        },
        { 
            id: 5, name: 'Gear Conductor', deity: 'EC-038', difficulty: 'medium', reward: 347, 
            desc: 'Machine overlord', portrait: '⚙',
            intro: ["INITIATING COMBAT PROTOCOLS...", "Your organic form is... inefficient.", "Prepare for systematic elimination!"],
            taunt: ["CALCULATING VICTORY...", "ERROR: YOUR DEFEAT IMMINENT", "PROCESSING... DESTRUCTION"],
            defeat: ["SYSTEM... FAILURE...", "RECALIBRATING... Perhaps organics have merit."],
            ability: { name: 'Overdrive', desc: 'Gains +1 KL every 2 turns', trigger: 'turn', interval: 2, effect: 'kl' }
        },
        { 
            id: 6, name: 'Pulse Commander', deity: 'EC-039', difficulty: 'hard', reward: 372, 
            desc: 'Energy incarnate', portrait: '⚡',
            intro: ["Feel the surge of pure energy!", "I am the storm made manifest!", "Lightning obeys my command!"],
            taunt: ["THUNDER ROARS!", "You cannot outrun lightning!", "SURGE OF POWER!"],
            defeat: ["The storm... subsides...", "Your will is stronger than lightning itself."],
            ability: { name: 'Chain Lightning', desc: 'Deals 1 damage to all enemies when casting spells', trigger: 'spell', effect: 'aoe', damage: 1 }
        },
        { 
            id: 7, name: 'Eclipse Herald', deity: 'EC-040', difficulty: 'hard', reward: 397, 
            desc: 'Twilight sovereign', portrait: '🌑',
            intro: ["The eclipse approaches...", "In twilight, all powers merge as one.", "Light and dark dance at my command!"],
            taunt: ["The sun dies!", "Darkness descends!", "Twilight consumes!"],
            defeat: ["Dawn... breaks through...", "You have pierced the eternal eclipse."],
            ability: { name: 'Eclipse', desc: 'Switches aspect mid-battle for bonuses', trigger: 'turn', interval: 3, effect: 'aspect_shift' }
        },
        { 
            id: 8, name: 'Void Empress', deity: 'EC-041', difficulty: 'hard', reward: 422, 
            desc: 'Queen of darkness', portrait: '👸',
            intro: ["Kneel before the Empress of Nothing!", "The Void answers to ME alone!", "Your essence will feed my darkness!"],
            taunt: ["THE VOID HUNGERS!", "Emptiness claims you!", "All returns to nothing!"],
            defeat: ["The Void... releases me...", "You have conquered the abyss itself. Incredible."],
            ability: { name: 'Void Drain', desc: 'Steals 1 Essence when hitting Deity', trigger: 'deity_damage', effect: 'drain', amount: 1 }
        },
        { 
            id: 9, name: 'Demon Lord Kaixu', deity: 'EC-069', difficulty: 'boss', reward: 472, 
            desc: 'Crownshatter Sovereign', portrait: '👑',
            intro: ["You dare challenge the Crownshatter Sovereign?!", "I have shattered empires with my power!", "BEHOLD THE FINAL SHARDSTORM!"],
            taunt: ["SHARDS CONSUME!", "THE CROWN SHATTERS!", "SOVEREIGN WRATH!"],
            defeat: ["Impossible... my crown... shatters...", "You... you are worthy of true power."],
            ability: { name: 'Shard War', desc: 'Heals 3 every 4 turns, +2 Attack to all Avatars', trigger: 'turn', interval: 4, effect: 'divine' }
        },
        { 
            id: 10, name: 'Crown Arbiter', deity: 'EC-036', difficulty: 'boss', reward: 722, 
            desc: 'The final challenge', portrait: '💎',
            intro: ["So... you have come at last.", "I am the Arbiter of the Essence Crown.", "Only the truly worthy may claim what I guard.", "PROVE. YOUR. WORTH!"],
            taunt: ["The Crown DENIES you!", "UNWORTHY!", "The Arbiter JUDGES!", "FINAL VERDICT: DESTRUCTION!"],
            defeat: ["At last... a true Sovereign emerges.", "The Essence Crown... is YOURS.", "Go forth, Shardkeeper. Rule wisely."],
            ability: { name: 'Crown\'s Judgment', desc: 'All abilities active, +3 starting Essence', trigger: 'start', effect: 'ultimate' },
            story: "THE ESSENCE CROWN IS YOURS!\n\nYou have conquered all challengers and proven yourself the ultimate Sovereign. The power of the Shards flows through you now. But remember - with great power comes great responsibility. New challenges await beyond the Crown..."
        }
    ],
    
    show() {
        document.getElementById('campaign-overlay').classList.remove('hidden');
        this.renderStoryMode();
    },
    
    async startTutorialBattle() {
        const tutorialChapter = this.getAllChapters().find(ch => ch.id === 1);
        if (!tutorialChapter) return;
        
        this.isTutorialMode = true;
        this.activeChapter = tutorialChapter;
        
        document.getElementById('main-menu').classList.add('hidden');
        
        await this.showTutorialIntro();
        
        const tutorialBoss = {
            id: tutorialChapter.id,
            name: 'Training Mentor',
            deity: tutorialChapter.bossDeity,
            difficulty: 'easy',
            reward: tutorialChapter.rewards.shards,
            desc: 'Your guide to the Shard Wars',
            portrait: '🎓',
            intro: ["Welcome, young Shardkeeper!", "I will guide you through your first battle.", "Let's begin your training!"],
            taunt: ["Good move!", "You're learning fast!", "Keep it up!"],
            defeat: ["Excellent work!", "You've learned the basics of the Shard Wars!", "Now you're ready for the real challenges..."],
            ability: null
        };
        this.activeBoss = tutorialBoss;
        
        Game.state.matchMode = 'campaign';
        Game.state.isAIMatch = true;
        Game.state.isTutorial = true;
        Game.state.currentBoss = tutorialBoss;
        AIManager.difficulty = 'easy';
        Game.state.bossDeck = BossDecks[1] || [];
        
        const bossDeity = getDeities().find(d => d.id === tutorialChapter.bossDeity);
        if (bossDeity) {
            Game.state.selectedDeities[1] = bossDeity;
            Game.log(`TUTORIAL: Learning the Basics`, 'phase');
        }
        
        Game.showDeitySelection(0);
    },
    
    async showTutorialIntro() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'story-cutscene-overlay';
            overlay.innerHTML = `
                <div class="cutscene-container tutorial-intro">
                    <div class="cutscene-header">
                        <div class="cutscene-portrait">🎓</div>
                        <div class="cutscene-title">Welcome to Essence Crown: Shard Wars</div>
                    </div>
                    <div class="cutscene-text">
                        <p>Greetings, aspiring Shardkeeper! You are about to learn the ancient art of Shard Warfare.</p>
                        <p><strong>Key Gameplay Tips:</strong></p>
                        <ul style="text-align: left; margin: 10px 20px; list-style: disc;">
                            <li><strong>Phases:</strong> Each turn has Dawn, Draw, Main, Clash, and Twilight phases</li>
                            <li><strong>Draw Phase:</strong> Click your DECK to draw a card</li>
                            <li><strong>Main Phase:</strong> Play Avatars and Spells from your hand</li>
                            <li><strong>Clash Phase:</strong> Attack with your Avatars</li>
                            <li><strong>KL (Kundalini):</strong> Energy used to play cards - shown on each card's cost</li>
                            <li><strong>Essence:</strong> Your life total - reach 0 and you lose!</li>
                        </ul>
                        <p>Now, choose your Deity and begin your first battle!</p>
                    </div>
                    <div class="cutscene-actions">
                        <button class="cutscene-btn" onclick="this.closest('.story-cutscene-overlay').remove()">BEGIN TRAINING</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            overlay.querySelector('.cutscene-btn').onclick = () => {
                overlay.remove();
                resolve();
            };
        });
    },
    
    renderStoryMode() {
        const container = document.getElementById('campaign-chapters');
        const allChapters = this.getAllChapters();
        const completed = this.progress.completed.length;
        const totalChapters = allChapters.length;
        
        document.getElementById('campaign-progress-bar').style.width = `${(completed / totalChapters) * 100}%`;
        document.getElementById('campaign-progress-text').textContent = `${completed} / ${totalChapters} Chapters Complete`;
        
        let html = `<div class="campaign-story-header">
            <h2 class="campaign-title">${this.story.title}</h2>
            <p class="campaign-subtitle">${this.story.subtitle}</p>
        </div>`;
        
        this.story.acts.forEach((act, actIndex) => {
            const actChaptersCompleted = act.chapters.filter(ch => this.progress.completed.includes(ch.id)).length;
            const isActLocked = actIndex > 0 && this.story.acts[actIndex - 1].chapters.some(ch => !this.progress.completed.includes(ch.id));
            
            html += `<div class="campaign-act ${isActLocked ? 'locked' : ''}">
                <div class="act-header">
                    <h3 class="act-title">${act.name}</h3>
                    <div class="act-progress">${actChaptersCompleted}/${act.chapters.length}</div>
                </div>
                <p class="act-summary">${act.summary}</p>
                <div class="act-chapters">`;
            
            act.chapters.forEach((chapter, chIndex) => {
                const isCompleted = this.progress.completed.includes(chapter.id);
                const prevChapter = chIndex > 0 ? act.chapters[chIndex - 1] : (actIndex > 0 ? this.story.acts[actIndex - 1].chapters.slice(-1)[0] : null);
                const isLocked = prevChapter && !this.progress.completed.includes(prevChapter.id);
                const isCurrent = !isCompleted && !isLocked;
                
                const chapterData = chapter;
                const difficultyStars = '★'.repeat(chapter.difficulty) + '☆'.repeat(10 - chapter.difficulty);
                
                html += `
                    <div class="chapter-card ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''} ${isCurrent ? 'current' : ''}" 
                         onclick="${!isLocked ? `CampaignManager.startStoryBattle(${chapter.id})` : ''}">
                        <div class="chapter-portrait">${chapter.portrait}</div>
                        <div class="chapter-header">
                            <div class="chapter-number">Ch. ${chapter.id}</div>
                            <h4 class="chapter-title">${chapter.title}</h4>
                        </div>
                        <div class="chapter-domain">${chapter.domains.join(' • ')}</div>
                        <div class="chapter-boss-name">${chapter.bossName}</div>
                        <div class="chapter-difficulty">${difficultyStars}</div>
                        <div class="chapter-prelude">${chapter.prelude}</div>
                        <div class="chapter-reward">${isCompleted ? '✓ Completed' : `💎 ${chapter.rewards.shards} Shards`}</div>
                        ${isLocked ? '<div class="lock-icon">🔒</div>' : ''}
                    </div>
                `;
            });
            
            html += `</div></div>`;
        });
        
        container.innerHTML = html;
    },
    
    render() {
        this.renderStoryMode();
    },
    
    async startStoryBattle(chapterId) {
        const chapter = this.getAllChapters().find(ch => ch.id === chapterId);
        if (!chapter) return;
        
        this.activeChapter = chapter;
        document.getElementById('campaign-overlay').classList.add('hidden');
        
        await this.showStoryCutscene(chapter);
        
        const storyBoss = {
            id: chapter.id,
            name: chapter.bossName,
            deity: chapter.bossDeity,
            difficulty: this.getDifficultyName(chapter.difficulty),
            reward: chapter.rewards.shards,
            desc: chapter.prelude,
            portrait: chapter.portrait,
            intro: chapter.cutscene.split('\n\n').slice(0, 2),
            taunt: ["Feel my power!", "You cannot win!", "The Crown demands your defeat!"],
            defeat: chapter.victory.split('\n\n').slice(0, 2),
            ability: chapter.ability
        };
        this.activeBoss = storyBoss;
        
        Game.state.matchMode = 'campaign';
        Game.state.isAIMatch = true;
        Game.state.currentBoss = storyBoss;
        AIManager.difficulty = storyBoss.difficulty;
        Game.state.bossDeck = BossDecks[chapterId] || [];
        
        const bossDeity = getDeities().find(d => d.id === chapter.bossDeity);
        if (bossDeity) {
            Game.state.selectedDeities[1] = bossDeity;
            Game.log(`CAMPAIGN: ${chapter.actName} - ${chapter.title}`, 'phase');
            Game.log(`Facing ${bossDeity.name} (${chapter.bossName})`, 'phase');
        }
        
        Game.showDeitySelection(0);
    },
    
    getDifficultyName(level) {
        if (level <= 2) return 'easy';
        if (level <= 5) return 'medium';
        if (level <= 8) return 'hard';
        return 'boss';
    },
    
    async showStoryCutscene(chapter) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'story-cutscene-overlay';
            overlay.innerHTML = `
                <div class="story-cutscene-container">
                    <div class="cutscene-header">
                        <div class="cutscene-act">${chapter.actName}</div>
                        <div class="cutscene-chapter">Chapter ${chapter.id}: ${chapter.title}</div>
                        <div class="cutscene-domain">${chapter.domains.join(' • ')}</div>
                    </div>
                    <div class="cutscene-content">
                        <div class="cutscene-portrait">${chapter.portrait}</div>
                        <div class="cutscene-text-wrapper">
                            <p class="cutscene-text" id="cutscene-text"></p>
                        </div>
                    </div>
                    <div class="cutscene-footer">
                        <div class="cutscene-boss-info">
                            <span class="boss-name">${chapter.bossName}</span>
                            <span class="boss-ability">${chapter.ability.name}: ${chapter.ability.desc}</span>
                        </div>
                        <button class="cutscene-btn" id="cutscene-next">Continue</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            const paragraphs = chapter.cutscene.split('\n\n').filter(p => p.trim());
            let currentPara = 0;
            const textEl = document.getElementById('cutscene-text');
            const btnEl = document.getElementById('cutscene-next');
            
            const showParagraph = () => {
                if (currentPara < paragraphs.length) {
                    textEl.innerHTML = paragraphs[currentPara].replace(/\n/g, '<br>');
                    textEl.classList.add('cutscene-fade-in');
                    setTimeout(() => textEl.classList.remove('cutscene-fade-in'), 500);
                    currentPara++;
                    btnEl.textContent = currentPara >= paragraphs.length ? 'BEGIN BATTLE!' : 'Continue';
                } else {
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        overlay.remove();
                        resolve();
                    }, 400);
                }
            };
            
            showParagraph();
            btnEl.onclick = showParagraph;
            
            BattleEffects.screenFlash('#2a0a4a', 500);
        });
    },
    
    async showVictoryCutscene(chapter) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'victory-cutscene-overlay';
            overlay.innerHTML = `
                <div class="victory-cutscene-container">
                    <div class="victory-banner">VICTORY</div>
                    <div class="victory-chapter">${chapter.title} Complete</div>
                    <div class="victory-portrait">${chapter.portrait}</div>
                    <div class="victory-text-wrapper">
                        <p class="victory-text" id="victory-text"></p>
                    </div>
                    <div class="victory-rewards">
                        <div class="reward-item">💎 ${chapter.rewards.shards} Shards</div>
                        ${chapter.rewards.title ? `<div class="reward-item">🏆 Title: "${chapter.rewards.title}"</div>` : ''}
                    </div>
                    <button class="victory-btn" id="victory-continue">Continue</button>
                </div>
            `;
            document.body.appendChild(overlay);
            
            const paragraphs = chapter.victory.split('\n\n').filter(p => p.trim());
            let currentPara = 0;
            const textEl = document.getElementById('victory-text');
            const btnEl = document.getElementById('victory-continue');
            
            const showParagraph = () => {
                if (currentPara < paragraphs.length) {
                    textEl.innerHTML = paragraphs[currentPara].replace(/\n/g, '<br>');
                    currentPara++;
                    btnEl.textContent = currentPara >= paragraphs.length ? 'Return to Campaign' : 'Continue';
                } else {
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        overlay.remove();
                        resolve();
                    }, 400);
                }
            };
            
            showParagraph();
            btnEl.onclick = showParagraph;
            
            BattleEffects.screenFlash('#d4af37', 500);
        });
    },
    
    async startBattle(bossId) {
        const boss = this.bosses.find(b => b.id === bossId);
        if (!boss) return;
        
        this.activeBoss = boss;
        document.getElementById('campaign-overlay').classList.add('hidden');
        
        await this.showBossIntro(boss);
        
        Game.state.matchMode = 'campaign';
        Game.state.isAIMatch = true;
        Game.state.currentBoss = boss;
        AIManager.difficulty = boss.difficulty;
        Game.state.bossDeck = BossDecks[boss.id] || [];
        
        const bossDeity = getDeities().find(d => d.id === boss.deity);
        if (bossDeity) {
            Game.state.selectedDeities[1] = bossDeity;
            Game.log(`CAMPAIGN: Facing ${bossDeity.name} (${boss.name})`, 'phase');
        }
        
        Game.showDeitySelection(0);
    },
    
    async showBossIntro(boss) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'boss-dialogue-overlay';
            overlay.innerHTML = `
                <div class="boss-dialogue-container">
                    <div class="boss-portrait-large">${boss.portrait}</div>
                    <div class="boss-dialogue-content">
                        <h2 class="boss-dialogue-name">${boss.name}</h2>
                        <div class="boss-ability-badge">${boss.ability.name}: ${boss.ability.desc}</div>
                        <p class="boss-dialogue-text" id="boss-dialogue-text"></p>
                        <button class="boss-dialogue-btn" id="boss-dialogue-next">Continue</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            let currentLine = 0;
            const textEl = document.getElementById('boss-dialogue-text');
            const btnEl = document.getElementById('boss-dialogue-next');
            
            const showLine = () => {
                if (currentLine < boss.intro.length) {
                    textEl.textContent = boss.intro[currentLine];
                    textEl.classList.add('dialogue-animate');
                    setTimeout(() => textEl.classList.remove('dialogue-animate'), 300);
                    currentLine++;
                    btnEl.textContent = currentLine >= boss.intro.length ? 'BEGIN BATTLE!' : 'Continue';
                } else {
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        overlay.remove();
                        resolve();
                    }, 300);
                }
            };
            
            showLine();
            btnEl.onclick = showLine;
            
            BattleEffects.screenFlash('#4a1a7a', 400);
        });
    },
    
    showBossTaunt() {
        if (!this.activeBoss || !this.activeBoss.taunt) return;
        const taunt = this.activeBoss.taunt[Math.floor(Math.random() * this.activeBoss.taunt.length)];
        this.showQuickDialogue(taunt);
    },
    
    showQuickDialogue(text) {
        const existing = document.querySelector('.boss-quick-dialogue');
        if (existing) existing.remove();
        
        const dialogue = document.createElement('div');
        dialogue.className = 'boss-quick-dialogue';
        dialogue.innerHTML = `
            <div class="boss-quick-portrait">${this.activeBoss?.portrait || '👹'}</div>
            <div class="boss-quick-text">${text}</div>
        `;
        document.body.appendChild(dialogue);
        
        setTimeout(() => dialogue.classList.add('show'), 10);
        setTimeout(() => {
            dialogue.classList.remove('show');
            setTimeout(() => dialogue.remove(), 300);
        }, 2500);
    },
    
    applyBossAbility(trigger, data = {}) {
        if (!this.activeBoss || !this.activeBoss.ability) return;
        const ability = this.activeBoss.ability;
        
        if (ability.trigger !== trigger) return;
        
        switch(ability.effect) {
            case 'draw':
                if (data.turn === ability.turn) {
                    Game.drawCard(1, 1);
                    this.showQuickDialogue(`${ability.name} activates!`);
                }
                break;
            case 'heal':
                Game.adjustStat(1, 'essence', ability.amount);
                this.showQuickDialogue(`${ability.name}: Restored ${ability.amount} Essence!`);
                break;
            case 'kl':
                if (data.turn % ability.interval === 0) {
                    Game.adjustStat(1, 'kl', 1);
                    this.showQuickDialogue(`${ability.name}: +1 KL!`);
                }
                break;
            case 'buff':
                const avatars = Game.state.players[1].avatarRow;
                if (avatars.length >= ability.threshold) {
                    avatars.forEach(a => a.attack = (a.attack || 0) + 1);
                    this.showQuickDialogue(`${ability.name}: Pack grows stronger!`);
                }
                break;
            case 'divine':
                if (data.turn % ability.interval === 0) {
                    Game.adjustStat(1, 'essence', 3);
                    this.showQuickDialogue(`${ability.name}: Divine healing!`);
                }
                break;
            case 'drain':
                Game.adjustStat(1, 'essence', ability.amount);
                this.showQuickDialogue(`${ability.name}: Essence stolen!`);
                break;
        }
    },
    
    async onBossDefeated(bossId) {
        if (this.progress.completed.includes(bossId)) return;
        
        this.progress.completed.push(bossId);
        this.progress.current = Math.max(this.progress.current, bossId);
        localStorage.setItem('ec-campaign-progress', JSON.stringify(this.progress));
        
        const chapter = this.getAllChapters().find(ch => ch.id === bossId);
        const boss = this.bosses.find(b => b.id === bossId);
        
        if (chapter) {
            MainMenu.awardShards(chapter.rewards.shards);
            Game.log(`CHAPTER COMPLETE! Earned ${chapter.rewards.shards} Shards!`, 'phase');
            if (chapter.rewards.title) {
                Game.log(`Title Unlocked: "${chapter.rewards.title}"`, 'phase');
            }
            await this.showVictoryCutscene(chapter);
        } else if (boss) {
            MainMenu.awardShards(boss.reward);
            Game.log(`BOSS DEFEATED! Earned ${boss.reward} Shards!`, 'phase');
            this.showVictoryDialogue(boss);
        }
    },
    
    showVictoryDialogue(boss) {
        setTimeout(() => {
            const overlay = document.createElement('div');
            overlay.className = 'boss-victory-overlay';
            overlay.innerHTML = `
                <div class="boss-victory-container">
                    <div class="victory-portrait">${boss.portrait}</div>
                    <h2>VICTORY!</h2>
                    <h3>${boss.name} Defeated!</h3>
                    <div class="defeat-dialogue">"${boss.defeat[0]}"</div>
                    ${boss.story ? `<div class="story-text">${boss.story}</div>` : ''}
                    <div class="victory-rewards">
                        <div class="reward-item">💎 ${boss.reward} Shards</div>
                    </div>
                    <button class="victory-btn" onclick="this.closest('.boss-victory-overlay').remove()">Continue</button>
                </div>
            `;
            document.body.appendChild(overlay);
            BattleEffects.screenFlash('#d4af37', 500);
        }, 1000);
    },
    
    save() {
        localStorage.setItem('ec-campaign-progress', JSON.stringify(this.progress));
    }
};

const DeckBuilder = {
    currentDeck: [],
    savedDecks: JSON.parse(localStorage.getItem('ec-saved-decks') || '[]'),
    
    show() {
        document.getElementById('deckbuilder-overlay').classList.remove('hidden');
        this.renderCardPool();
        this.renderCurrentDeck();
        this.renderSavedDecks();
        this.bindEvents();
    },
    
    bindEvents() {
        document.getElementById('deck-search').oninput = () => this.renderCardPool();
        document.getElementById('deck-filter-type').onchange = () => this.renderCardPool();
        document.getElementById('deck-filter-aspect').onchange = () => this.renderCardPool();
    },
    
    renderCardPool() {
        const search = document.getElementById('deck-search').value.toLowerCase();
        const typeFilter = document.getElementById('deck-filter-type').value;
        const aspectFilter = document.getElementById('deck-filter-aspect').value;
        
        let cards = ALL_CARDS.filter(c => c.type !== 'Deity');
        
        if (search) cards = cards.filter(c => c.name.toLowerCase().includes(search));
        if (typeFilter) cards = cards.filter(c => c.type === typeFilter);
        if (aspectFilter) cards = cards.filter(c => c.aspects && c.aspects.includes(aspectFilter));
        
        const container = document.getElementById('deck-card-pool');
        const types = ['Avatar', 'Spell', 'Domain', 'Relic'];
        
        let html = '';
        types.forEach(type => {
            const typeCards = cards.filter(c => c.type === type);
            if (typeCards.length > 0) {
                html += `<div class="pool-section">
                    <h4 class="pool-section-title">${type}s</h4>
                    <div class="pool-cards-group">
                        ${typeCards.map(c => `
                            <div class="pool-card" draggable="true" 
                                 ondragstart="DeckBuilder.dragStart(event, '${c.id}')"
                                 ondblclick="DeckBuilder.showCardDetail('${c.id}')">
                                <img src="${c.image}" alt="${c.name}">
                                <div class="pool-card-info">
                                    <span class="pool-card-name">${c.name}</span>
                                    <span class="pool-card-cost">${c.cost} KL</span>
                                </div>
                                <div class="pool-card-hint">Drag to add • Double-click to view</div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }
        });
        container.innerHTML = html;
    },
    
    renderCurrentDeck() {
        const container = document.getElementById('deck-current-cards');
        document.getElementById('deck-card-count').textContent = this.currentDeck.length;
        
        const cardCounts = {};
        this.currentDeck.forEach(id => {
            cardCounts[id] = (cardCounts[id] || 0) + 1;
        });
        
        container.innerHTML = Object.entries(cardCounts).map(([id, count]) => {
            const card = ALL_CARDS.find(c => c.id === id);
            if (!card) return '';
            return `
                <div class="deck-card-entry" data-card-id="${id}" draggable="true"
                     ondragstart="DeckBuilder.dragStart(event, '${id}')"
                     ondblclick="DeckBuilder.showCardDetail('${id}')">
                    <img class="deck-card-thumb" src="${card.image}" alt="${card.name}">
                    <div class="deck-card-info">
                        <span class="deck-card-name">${card.name}</span>
                        <span class="deck-card-meta">${card.type} • ${card.cost} KL</span>
                    </div>
                    <span class="deck-card-count">x${count}</span>
                    <span class="deck-card-remove" onclick="event.stopPropagation(); DeckBuilder.removeCard('${id}')">✕</span>
                </div>
            `;
        }).join('');
        
        this.updateDeckStats();
        this.updateDeckValidity();
    },
    
    updateDeckStats() {
        const cards = this.currentDeck.map(id => ALL_CARDS.find(c => c.id === id)).filter(Boolean);
        const total = cards.length || 1;
        
        const klCounts = [0, 0, 0, 0, 0, 0, 0];
        cards.forEach(c => {
            const cost = Math.min(c.cost || 0, 6);
            klCounts[cost]++;
        });
        const maxKL = Math.max(...klCounts, 1);
        
        document.querySelectorAll('.ec-kl-bar').forEach((bar, i) => {
            const fill = bar.querySelector('.bar-fill');
            if (fill) {
                const height = (klCounts[i] / maxKL) * 60;
                fill.style.height = height + 'px';
            }
        });
        
        const types = { Avatar: 0, Spell: 0, Domain: 0, Relic: 0 };
        cards.forEach(c => { if (types[c.type] !== undefined) types[c.type]++; });
        
        Object.entries(types).forEach(([type, count]) => {
            const bar = document.getElementById(`type-${type.toLowerCase()}-bar`);
            const countEl = document.getElementById(`type-${type.toLowerCase()}-count`);
            if (bar) bar.style.width = (count / total * 100) + '%';
            if (countEl) countEl.textContent = count;
        });
        
        const aspects = { Glow: 0, Void: 0, Gray: 0 };
        cards.forEach(c => {
            (c.aspects || []).forEach(a => { if (aspects[a] !== undefined) aspects[a]++; });
        });
        
        Object.entries(aspects).forEach(([aspect, count]) => {
            const countEl = document.getElementById(`aspect-${aspect.toLowerCase()}-count`);
            if (countEl) countEl.textContent = count;
        });
    },
    
    updateDeckValidity() {
        const validity = document.getElementById('deck-validity');
        if (!validity) return;
        
        const count = this.currentDeck.length;
        if (count === 60) {
            validity.classList.remove('invalid');
            validity.classList.add('valid');
            validity.innerHTML = '<span class="validity-icon">✓</span><span class="validity-text">Ready to battle!</span>';
        } else {
            validity.classList.add('invalid');
            validity.classList.remove('valid');
            validity.innerHTML = `<span class="validity-icon">⚠</span><span class="validity-text">${60 - count} more cards needed</span>`;
        }
    },
    
    addCard(cardId) {
        if (this.currentDeck.length >= 60) {
            Game.showPrompt('Deck is full (60 cards max)');
            return;
        }
        
        const count = this.currentDeck.filter(id => id === cardId).length;
        if (count >= 3) {
            Game.showPrompt('Maximum 3 copies per card');
            return;
        }
        
        this.currentDeck.push(cardId);
        this.renderCurrentDeck();
        
        setTimeout(() => {
            const entry = document.querySelector(`.deck-card-entry[data-card-id="${cardId}"]`);
            if (entry) {
                entry.classList.add('ec-flash-add');
                setTimeout(() => entry.classList.remove('ec-flash-add'), 400);
            }
        }, 50);
    },
    
    removeCard(cardId) {
        const entry = document.querySelector(`.deck-card-entry[data-card-id="${cardId}"]`);
        if (entry) {
            entry.classList.add('ec-flash-remove');
            setTimeout(() => {
                const idx = this.currentDeck.indexOf(cardId);
                if (idx > -1) {
                    this.currentDeck.splice(idx, 1);
                    this.renderCurrentDeck();
                }
            }, 300);
        } else {
            const idx = this.currentDeck.indexOf(cardId);
            if (idx > -1) {
                this.currentDeck.splice(idx, 1);
                this.renderCurrentDeck();
            }
        }
    },
    
    clearDeck() {
        this.currentDeck = [];
        this.renderCurrentDeck();
    },
    
    saveDeck() {
        const name = document.getElementById('deck-name').value || 'New Deck';
        if (this.currentDeck.length !== 60) {
            Game.showPrompt('Deck must be exactly 60 cards');
            return;
        }
        
        const deck = { name, cards: [...this.currentDeck], created: Date.now() };
        this.savedDecks.push(deck);
        localStorage.setItem('ec-saved-decks', JSON.stringify(this.savedDecks));
        this.renderSavedDecks();
        Game.showPrompt(`Deck "${name}" saved!`);
    },
    
    renderSavedDecks() {
        const container = document.getElementById('saved-decks-list');
        if (!container) return;
        
        if (this.savedDecks.length === 0) {
            container.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.85em; text-align: center; padding: 20px;">No saved decks yet</p>';
            return;
        }
        
        container.innerHTML = this.savedDecks.map((deck, i) => `
            <div class="ec-saved-deck-card">
                <span class="deck-icon">📚</span>
                <span class="deck-name">${deck.name}</span>
                <span class="deck-count">${deck.cards.length}/60</span>
                <div class="deck-actions">
                    <button class="deck-action-btn load" onclick="DeckBuilder.loadDeck(${i})">Load</button>
                    <button class="deck-action-btn delete" onclick="DeckBuilder.deleteDeck(${i})">✕</button>
                </div>
            </div>
        `).join('');
    },
    
    loadDeck(index) {
        if (index < 0 || index >= this.savedDecks.length) return;
        this.currentDeck = [...this.savedDecks[index].cards];
        document.getElementById('deck-name').value = this.savedDecks[index].name;
        this.renderCurrentDeck();
        Game.showPrompt(`Loaded "${this.savedDecks[index].name}"`);
    },
    
    deleteDeck(index) {
        if (index < 0 || index >= this.savedDecks.length) return;
        const name = this.savedDecks[index].name;
        this.savedDecks.splice(index, 1);
        localStorage.setItem('ec-saved-decks', JSON.stringify(this.savedDecks));
        this.renderSavedDecks();
        Game.showPrompt(`Deleted "${name}"`);
    },
    
    playWithDeck() {
        if (this.currentDeck.length !== 60) {
            Game.showPrompt('Deck must be exactly 60 cards');
            return;
        }
        
        document.getElementById('deckbuilder-overlay').classList.add('hidden');
        Game.state.matchMode = 'casual';
        Game.state.isAIMatch = true;
        Game.state.aiDifficulty = 'medium';
        Game.state.customDeck = [...this.currentDeck];
        AIManager.difficulty = 'medium';
        
        Game.showDeitySelection(0);
    },
    
    dragStart(event, cardId) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('cardId', cardId);
    },
    
    showCardDetail(cardId) {
        const card = ALL_CARDS.find(c => c.id === cardId);
        if (!card) return;
        
        this.currentDetailCardId = cardId;
        
        document.getElementById('card-detail-name').textContent = card.name;
        document.getElementById('card-detail-img').src = card.image;
        document.getElementById('card-detail-type').textContent = card.type;
        document.getElementById('card-detail-cost').textContent = `${card.cost} KL`;
        document.getElementById('card-detail-aspects').textContent = card.aspects ? `${card.aspects.join(' / ')}` : '';
        
        let statsHtml = '';
        if (card.attack !== undefined || card.health !== undefined) {
            statsHtml = `<div class="stat"><span class="stat-label">Power:</span> ${card.attack || 0}</div>`;
            statsHtml += `<div class="stat"><span class="stat-label">Health:</span> ${card.health || 0}</div>`;
        }
        document.getElementById('card-detail-stats').innerHTML = statsHtml;
        document.getElementById('card-detail-effect').textContent = card.effect || card.keywords?.join(', ') || 'No effect';
        
        document.getElementById('card-detail-modal').classList.remove('hidden');
    },
    
    closeCardDetail() {
        document.getElementById('card-detail-modal').classList.add('hidden');
        this.currentDetailCardId = null;
    },
    
    quickAddCard() {
        if (this.currentDetailCardId) {
            const addBtn = document.querySelector('.card-detail-btn');
            addBtn.style.display = 'block';
            this.addCard(this.currentDetailCardId);
            this.closeCardDetail();
        }
    }
};

const Collection = {
    currentTab: 'cards',
    
    show() {
        document.getElementById('collection-overlay').classList.remove('hidden');
        this.showTab('cards');
    },
    
    showTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.coll-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.coll-tab[onclick*="${tab}"]`)?.classList.add('active');
        
        const container = document.getElementById('collection-grid');
        
        switch(tab) {
            case 'cards':
                this.renderCards(container);
                break;
            case 'deities':
                this.renderDeities(container);
                break;
            case 'cosmetics':
                this.renderCosmetics(container);
                break;
        }
    },
    
    renderCards(container) {
        const cards = ALL_CARDS.filter(c => c.type !== 'Deity');
        const types = ['Avatar', 'Spell', 'Domain', 'Relic'];
        
        let html = '';
        types.forEach(type => {
            const typeCards = cards.filter(c => c.type === type);
            if (typeCards.length > 0) {
                html += `<div class="collection-section">
                    <h3 class="section-title">${type}s (${typeCards.length})</h3>
                    <div class="collection-cards">
                        ${typeCards.map(c => `
                            <div class="coll-card" draggable="true"
                                 ondragstart="Collection.dragStart(event, '${c.id}')"
                                 ondblclick="Collection.showCardDetail('${c.id}')">
                                <img src="${c.image}" alt="${c.name}">
                                <div class="coll-card-name">${c.name}</div>
                                <div class="coll-card-hint">Double-click to view</div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }
        });
        container.innerHTML = html;
    },
    
    dragStart(event, cardId) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('cardId', cardId);
    },
    
    showCardDetail(cardId) {
        const card = ALL_CARDS.find(c => c.id === cardId);
        if (!card) return;
        
        this.currentDetailCardId = cardId;
        
        document.getElementById('card-detail-name').textContent = card.name;
        document.getElementById('card-detail-img').src = card.image;
        document.getElementById('card-detail-type').textContent = card.type;
        document.getElementById('card-detail-cost').textContent = `${card.cost} KL`;
        document.getElementById('card-detail-aspects').textContent = card.aspects ? `${card.aspects.join(' / ')}` : '';
        
        let statsHtml = '';
        if (card.attack !== undefined || card.health !== undefined) {
            statsHtml = `<div class="stat"><span class="stat-label">Power:</span> ${card.attack || 0}</div>`;
            statsHtml += `<div class="stat"><span class="stat-label">Health:</span> ${card.health || 0}</div>`;
        }
        document.getElementById('card-detail-stats').innerHTML = statsHtml;
        document.getElementById('card-detail-effect').textContent = card.effect || card.keywords?.join(', ') || 'No effect';
        
        // Hide the add button in collection view
        const addBtn = document.querySelector('.card-detail-btn');
        addBtn.style.display = 'none';
        
        document.getElementById('card-detail-modal').classList.remove('hidden');
    },
    
    closeCardDetail() {
        document.getElementById('card-detail-modal').classList.add('hidden');
        this.currentDetailCardId = null;
    },
    
    renderDeities(container) {
        const deities = getDeities();
        container.innerHTML = deities.map(d => `
            <div class="coll-card deity" onclick="Game.showCardZoom('${d.id}')">
                <img src="${d.image}" alt="${d.name}">
                <div class="coll-card-name">${d.name}</div>
                <div class="coll-card-stats">${d.health} Essence | ${d.startingKL || 3} KL</div>
            </div>
        `).join('');
    },
    
    renderCosmetics(container) {
        container.innerHTML = `
            <div class="cosmetics-section">
                <h3>Card Backs</h3>
                <div class="cosmetics-grid">
                    ${CosmeticsManager.inventory.cardBack.map(c => 
                        `<div class="cosmetic-item ${c.owned ? 'owned' : ''}">${c.name}</div>`
                    ).join('')}
                </div>
            </div>
        `;
    }
};

const AccessibilitySettings = {
    settings: JSON.parse(localStorage.getItem('ec-accessibility') || '{}'),
    
    defaults: {
        textSize: 'medium',
        colorblindMode: 'off',
        lowFxMode: false,
        highContrast: false,
        reduceMotion: false
    },
    
    init() {
        this.settings = { ...this.defaults, ...this.settings };
        this.apply();
    },
    
    get(key) {
        return this.settings[key] ?? this.defaults[key];
    },
    
    set(key, value) {
        this.settings[key] = value;
        this.save();
        this.apply();
    },
    
    save() {
        localStorage.setItem('ec-accessibility', JSON.stringify(this.settings));
    },
    
    apply() {
        const root = document.documentElement;
        const body = document.body;
        
        body.classList.remove('text-small', 'text-medium', 'text-large');
        body.classList.add(`text-${this.get('textSize')}`);
        
        body.classList.remove('colorblind-off', 'colorblind-deuteranopia', 'colorblind-protanopia', 'colorblind-tritanopia');
        body.classList.add(`colorblind-${this.get('colorblindMode')}`);
        
        body.classList.toggle('low-fx', this.get('lowFxMode'));
        body.classList.toggle('high-contrast', this.get('highContrast'));
        body.classList.toggle('reduce-motion', this.get('reduceMotion'));
    },
    
    getColorblindPalette() {
        const palettes = {
            off: { glow: '#00ffcc', void: '#9333ea', gray: '#6b7280', damage: '#ff4444' },
            deuteranopia: { glow: '#0077bb', void: '#ee7733', gray: '#bbbbbb', damage: '#cc3311' },
            protanopia: { glow: '#33bbee', void: '#ee3377', gray: '#bbbbbb', damage: '#cc3311' },
            tritanopia: { glow: '#009988', void: '#ee3377', gray: '#bbbbbb', damage: '#cc3311' }
        };
        return palettes[this.get('colorblindMode')] || palettes.off;
    }
};

const SandboxMode = {
    active: false,
    savedStates: JSON.parse(localStorage.getItem('ec-sandbox-states') || '[]'),
    
    enter() {
        this.active = true;
        Game.state.isSandboxMode = true;
        Game.log('SANDBOX MODE: Board editing enabled', 'phase');
    },
    
    exit() {
        this.active = false;
        Game.state.isSandboxMode = false;
    },
    
    setEssence(playerIndex, value) {
        if (!this.active) return;
        const val = Math.max(0, Math.min(99, parseInt(value) || 0));
        Game.state.players[playerIndex].essence = val;
        Game.render();
        Game.log(`Sandbox: P${playerIndex + 1} Essence set to ${val}`, 'action');
    },
    
    setKL(playerIndex, current, max) {
        if (!this.active) return;
        const c = Math.max(0, Math.min(20, parseInt(current) || 0));
        const m = Math.max(1, Math.min(20, parseInt(max) || 3));
        Game.state.players[playerIndex].klCurrent = Math.min(c, m);
        Game.state.players[playerIndex].klMax = m;
        Game.render();
        Game.log(`Sandbox: P${playerIndex + 1} KL set to ${c}/${m}`, 'action');
    },
    
    addCardToZone(playerIndex, cardId, zone) {
        if (!this.active) return;
        const card = ALL_CARDS.find(c => c.id === cardId);
        if (!card) return;
        
        const instance = Game.createCardInstance(card);
        const p = Game.state.players[playerIndex];
        
        switch(zone) {
            case 'hand': p.hand.push(instance); break;
            case 'avatar': p.avatarRow.push(instance); break;
            case 'domain': p.domainRow.push(instance); break;
            case 'relic': p.relicRow.push(instance); break;
            case 'spell': p.spellRow.push(instance); break;
            case 'graveyard': p.graveyard.push(instance); break;
            case 'deck': p.deck.push(instance); break;
        }
        
        Game.render();
        Game.log(`Sandbox: Added ${card.name} to P${playerIndex + 1} ${zone}`, 'action');
    },
    
    removeCardFromZone(playerIndex, instanceId, zone) {
        if (!this.active) return;
        const p = Game.state.players[playerIndex];
        let arr;
        
        switch(zone) {
            case 'hand': arr = p.hand; break;
            case 'avatar': arr = p.avatarRow; break;
            case 'domain': arr = p.domainRow; break;
            case 'relic': arr = p.relicRow; break;
            case 'spell': arr = p.spellRow; break;
            case 'graveyard': arr = p.graveyard; break;
            case 'deck': arr = p.deck; break;
            default: return;
        }
        
        const idx = arr.findIndex(c => c.instanceId === instanceId);
        if (idx >= 0) {
            const removed = arr.splice(idx, 1)[0];
            Game.render();
            Game.log(`Sandbox: Removed ${removed.name} from P${playerIndex + 1} ${zone}`, 'action');
        }
    },
    
    moveCard(playerIndex, instanceId, fromZone, toZone) {
        if (!this.active) return;
        const p = Game.state.players[playerIndex];
        
        const zones = {
            hand: p.hand, avatar: p.avatarRow, domain: p.domainRow,
            relic: p.relicRow, spell: p.spellRow, graveyard: p.graveyard, deck: p.deck
        };
        
        const from = zones[fromZone];
        const to = zones[toZone];
        if (!from || !to) return;
        
        const idx = from.findIndex(c => c.instanceId === instanceId);
        if (idx >= 0) {
            const card = from.splice(idx, 1)[0];
            to.push(card);
            Game.render();
            Game.log(`Sandbox: Moved ${card.name} from ${fromZone} to ${toZone}`, 'action');
        }
    },
    
    setCardStats(instanceId, attack, health) {
        if (!this.active) return;
        for (let p of Game.state.players) {
            for (let zone of [p.avatarRow, p.hand]) {
                const card = zone.find(c => c.instanceId === instanceId);
                if (card) {
                    if (attack !== undefined) card.attack = parseInt(attack) || 0;
                    if (health !== undefined) {
                        card.health = parseInt(health) || 1;
                        card.healthCurrent = card.health;
                    }
                    Game.render();
                    return;
                }
            }
        }
    },
    
    saveState(name) {
        const state = {
            name: name || `State ${Date.now()}`,
            timestamp: Date.now(),
            players: Game.state.players.map(p => ({
                essence: p.essence,
                klCurrent: p.klCurrent,
                klMax: p.klMax,
                overflow: p.overflow,
                godCodeCharges: p.godCodeCharges,
                godCodeUsed: p.godCodeUsed,
                deity: p.deity ? { id: p.deity.id, name: p.deity.name } : null,
                hand: p.hand.map(c => c.id),
                deck: p.deck.map(c => c.id),
                avatarRow: p.avatarRow.map(c => ({ id: c.id, attack: c.attack, health: c.healthCurrent, tapped: c.tapped })),
                domainRow: p.domainRow.map(c => c.id),
                relicRow: p.relicRow.map(c => c.id),
                spellRow: p.spellRow.map(c => c.id),
                graveyard: p.graveyard.map(c => c.id),
                banished: p.banished.map(c => c.id)
            })),
            turnNumber: Game.state.turnNumber,
            currentPlayer: Game.state.currentPlayer,
            currentPhase: Game.state.currentPhase
        };
        
        this.savedStates.unshift(state);
        if (this.savedStates.length > 10) this.savedStates.pop();
        localStorage.setItem('ec-sandbox-states', JSON.stringify(this.savedStates));
        Game.log(`Sandbox: State saved as "${state.name}"`, 'phase');
        return state;
    },
    
    loadState(index) {
        const state = this.savedStates[index];
        if (!state) return false;
        
        Game.state.turnNumber = state.turnNumber;
        Game.state.currentPlayer = state.currentPlayer;
        Game.state.currentPhase = state.currentPhase;
        
        for (let i = 0; i < 2; i++) {
            const ps = state.players[i];
            const p = Game.state.players[i];
            
            p.essence = ps.essence;
            p.klCurrent = ps.klCurrent;
            p.klMax = ps.klMax;
            p.overflow = ps.overflow;
            p.godCodeCharges = ps.godCodeCharges ?? 1;
            p.godCodeUsed = ps.godCodeUsed ?? false;
            
            if (ps.deity) {
                const deity = ALL_CARDS.find(c => c.id === ps.deity.id || c.id === ps.deity);
                if (deity) p.deity = Game.createCardInstance(deity);
            }
            
            const loadCards = (ids) => (ids || []).map(id => {
                const card = ALL_CARDS.find(c => c.id === id);
                return card ? Game.createCardInstance(card) : null;
            }).filter(Boolean);
            
            p.hand = loadCards(ps.hand);
            p.deck = loadCards(ps.deck);
            p.domainRow = loadCards(ps.domainRow);
            p.relicRow = loadCards(ps.relicRow);
            p.spellRow = loadCards(ps.spellRow);
            p.graveyard = loadCards(ps.graveyard);
            p.banished = loadCards(ps.banished);
            
            p.avatarRow = (ps.avatarRow || []).map(data => {
                const card = ALL_CARDS.find(c => c.id === data.id);
                if (!card) return null;
                const inst = Game.createCardInstance(card);
                inst.attack = data.attack;
                inst.healthCurrent = data.health;
                inst.tapped = data.tapped;
                return inst;
            }).filter(Boolean);
        }
        
        Game.render();
        Game.log(`Sandbox: Loaded state "${state.name}"`, 'phase');
        return true;
    },
    
    clearBoard(playerIndex) {
        if (!this.active) return;
        const p = Game.state.players[playerIndex];
        p.hand = [];
        p.deck = [];
        p.avatarRow = [];
        p.domainRow = [];
        p.relicRow = [];
        p.spellRow = [];
        p.graveyard = [];
        p.banished = [];
        Game.render();
        Game.log(`Sandbox: Cleared P${playerIndex + 1} board`, 'action');
    },
    
    startGame() {
        this.active = false;
        Game.state.isSandboxMode = true;
        Game.setPhase('main');
        Game.log('Sandbox: Game started - play freely!', 'phase');
    }
};

const CustomLobby = {
    lobbies: [],
    currentLobby: null,
    
    presets: {
        standard: { name: 'Standard', essence: 23, kl: 3, aspects: ['Glow', 'Void', 'Gray'], types: null, victory: 'essence' },
        highLife: { name: 'High Life', essence: 40, kl: 3, aspects: null, types: null, victory: 'essence' },
        turbo: { name: 'Turbo', essence: 15, kl: 6, aspects: null, types: null, victory: 'essence' },
        avatarsOnly: { name: 'Avatars Only', essence: 23, kl: 3, aspects: null, types: ['Avatar'], victory: 'essence' },
        spellsUnleashed: { name: 'Spells Unleashed', essence: 23, kl: 5, aspects: null, types: ['Spell', 'Avatar'], victory: 'essence' },
        voidWar: { name: 'Void War', essence: 23, kl: 3, aspects: ['Void'], types: null, victory: 'essence' },
        glowCrusade: { name: 'Glow Crusade', essence: 23, kl: 3, aspects: ['Glow'], types: null, victory: 'essence' },
        sudden: { name: 'Sudden Death', essence: 10, kl: 5, aspects: null, types: null, victory: 'essence' },
        domination: { name: 'Domination', essence: 30, kl: 3, aspects: null, types: null, victory: 'avatars', avatarWinCount: 5 }
    },
    
    create(hostName, settings = {}) {
        const lobby = {
            id: `lobby-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            host: hostName,
            created: Date.now(),
            status: 'waiting',
            players: [hostName],
            maxPlayers: 2,
            settings: {
                name: settings.name || 'Custom Match',
                startingEssence: settings.essence ?? 23,
                startingKL: settings.kl ?? 3,
                maxKL: settings.maxKL ?? 13,
                allowedAspects: settings.aspects || null,
                allowedTypes: settings.types || null,
                bannedCards: settings.bannedCards || [],
                victoryCondition: settings.victory || 'essence',
                avatarWinCount: settings.avatarWinCount || 5,
                customRules: settings.customRules || [],
                preset: settings.preset || null
            }
        };
        
        this.lobbies.push(lobby);
        this.currentLobby = lobby;
        return lobby;
    },
    
    join(lobbyId, playerName) {
        const lobby = this.lobbies.find(l => l.id === lobbyId);
        if (!lobby) return { success: false, error: 'Lobby not found' };
        if (lobby.status !== 'waiting') return { success: false, error: 'Lobby is not accepting players' };
        if (lobby.players.length >= lobby.maxPlayers) return { success: false, error: 'Lobby is full' };
        if (lobby.players.includes(playerName)) return { success: false, error: 'Already in lobby' };
        
        lobby.players.push(playerName);
        this.currentLobby = lobby;
        return { success: true, lobby };
    },
    
    leave(lobbyId, playerName) {
        const lobby = this.lobbies.find(l => l.id === lobbyId);
        if (!lobby) return;
        
        lobby.players = lobby.players.filter(p => p !== playerName);
        if (lobby.players.length === 0 || lobby.host === playerName) {
            this.lobbies = this.lobbies.filter(l => l.id !== lobbyId);
        }
        
        if (this.currentLobby?.id === lobbyId) {
            this.currentLobby = null;
        }
    },
    
    updateSettings(lobbyId, newSettings) {
        const lobby = this.lobbies.find(l => l.id === lobbyId);
        if (!lobby) return false;
        
        Object.assign(lobby.settings, newSettings);
        return true;
    },
    
    applyPreset(lobbyId, presetName) {
        const preset = this.presets[presetName];
        if (!preset) return false;
        
        return this.updateSettings(lobbyId, {
            name: preset.name,
            startingEssence: preset.essence,
            startingKL: preset.kl,
            allowedAspects: preset.aspects,
            allowedTypes: preset.types,
            victoryCondition: preset.victory,
            avatarWinCount: preset.avatarWinCount,
            preset: presetName
        });
    },
    
    start(lobbyId) {
        const lobby = this.lobbies.find(l => l.id === lobbyId);
        if (!lobby || lobby.players.length < 2) return false;
        
        lobby.status = 'started';
        return lobby;
    },
    
    getOpenLobbies() {
        return this.lobbies.filter(l => l.status === 'waiting' && l.players.length < l.maxPlayers);
    },
    
    isCardAllowed(card, settings) {
        if (settings.bannedCards?.includes(card.id)) return false;
        if (settings.allowedAspects && !settings.allowedAspects.includes(card.aspect)) return false;
        if (settings.allowedTypes && !settings.allowedTypes.includes(card.type)) return false;
        return true;
    },
    
    checkVictory(settings) {
        if (settings.victoryCondition === 'avatars') {
            const p1Destroyed = Game.state.players[1].graveyard.filter(c => c.type === 'Avatar').length;
            const p2Destroyed = Game.state.players[0].graveyard.filter(c => c.type === 'Avatar').length;
            
            if (p1Destroyed >= settings.avatarWinCount) return 0;
            if (p2Destroyed >= settings.avatarWinCount) return 1;
        }
        return null;
    }
};

const MatchRecorder = {
    currentMatch: null,
    savedMatches: JSON.parse(localStorage.getItem('ec-match-replays') || '[]'),
    liveMatches: [],
    
    startRecording(matchId, player1Deity, player2Deity, matchMode) {
        this.currentMatch = {
            matchId: matchId,
            timestamp: Date.now(),
            matchMode: matchMode,
            player1Deity: player1Deity?.name || 'Unknown',
            player2Deity: player2Deity?.name || 'Unknown',
            winner: null,
            turnCount: 0,
            actions: [],
            stateSnapshots: [],
            cardsPlayed: [],
            deckCards: { p1: [], p2: [] }
        };
        this.takeSnapshot('MATCH_START');
    },
    
    recordAction(actionType, data, playerIndex = 0) {
        if (!this.currentMatch) return;
        const action = {
            seq: this.currentMatch.actions.length,
            timestamp: Date.now(),
            turn: Game.state?.turnNumber || 1,
            phase: Game.state?.currentPhase || 'main',
            player: playerIndex,
            type: actionType,
            data: JSON.parse(JSON.stringify(data))
        };
        this.currentMatch.actions.push(action);
        
        if (['CARD_PLAYED', 'ATTACK', 'PHASE_CHANGE', 'TURN_END'].includes(actionType)) {
            this.takeSnapshot(actionType);
        }
    },
    
    takeSnapshot(trigger) {
        if (!this.currentMatch || !Game.state) return;
        const snapshot = {
            trigger: trigger,
            seq: this.currentMatch.stateSnapshots.length,
            timestamp: Date.now(),
            turnNumber: Game.state.turnNumber,
            currentPhase: Game.state.currentPhase,
            currentPlayer: Game.state.currentPlayer,
            players: Game.state.players.map(p => ({
                essence: p.essence,
                klCurrent: p.klCurrent,
                klMax: p.klMax,
                overflow: p.overflow,
                godCodeCharges: p.godCodeCharges,
                handCount: p.hand.length,
                deckCount: p.deck.length,
                graveyardCount: p.graveyard.length,
                avatarRow: p.avatarRow.map(c => ({ id: c.id, name: c.name, attack: c.attack, health: c.health, tapped: c.tapped })),
                domainRow: p.domainRow.map(c => ({ id: c.id, name: c.name }))
            }))
        };
        this.currentMatch.stateSnapshots.push(snapshot);
    },
    
    recordCardPlayed(card, playerIndex) {
        if (!this.currentMatch) return;
        this.currentMatch.cardsPlayed.push({
            cardId: card.id,
            cardName: card.name,
            cardType: card.type,
            aspect: card.aspect,
            cost: card.cost,
            player: playerIndex,
            turn: Game.state?.turnNumber || 1
        });
    },
    
    recordDeckContents(playerIndex, deck) {
        if (!this.currentMatch) return;
        const deckKey = playerIndex === 0 ? 'p1' : 'p2';
        this.currentMatch.deckCards[deckKey] = deck.map(c => c.id);
    },
    
    endRecording(winnerIndex) {
        if (!this.currentMatch) return null;
        this.currentMatch.winner = winnerIndex;
        this.currentMatch.turnCount = Game.state?.turnNumber || 1;
        this.currentMatch.duration = Date.now() - this.currentMatch.timestamp;
        this.takeSnapshot('MATCH_END');
        
        const completedMatch = { ...this.currentMatch };
        this.savedMatches.unshift(completedMatch);
        if (this.savedMatches.length > 20) this.savedMatches.pop();
        localStorage.setItem('ec-match-replays', JSON.stringify(this.savedMatches));
        
        Analytics.recordMatchResult(completedMatch);
        
        this.currentMatch = null;
        return completedMatch;
    },
    
    getReplay(matchId) {
        return this.savedMatches.find(m => m.matchId === matchId);
    },
    
    getAllReplays() {
        return this.savedMatches;
    },
    
    registerLiveMatch(matchId, matchData) {
        this.liveMatches.push({ matchId, ...matchData, lastUpdate: Date.now() });
    },
    
    getLiveMatches() {
        return this.liveMatches.filter(m => Date.now() - m.lastUpdate < 300000);
    }
};

const Analytics = {
    data: JSON.parse(localStorage.getItem('ec-analytics') || '{"cardStats":{},"deckArchetypes":{},"matchHistory":[]}'),
    
    recordMatchResult(match) {
        const winnerCards = match.cardsPlayed.filter(c => c.player === match.winner);
        const loserCards = match.cardsPlayed.filter(c => c.player !== match.winner);
        
        winnerCards.forEach(card => {
            if (!this.data.cardStats[card.cardId]) {
                this.data.cardStats[card.cardId] = { name: card.cardName, type: card.cardType, aspect: card.aspect, played: 0, wins: 0, losses: 0 };
            }
            this.data.cardStats[card.cardId].played++;
            this.data.cardStats[card.cardId].wins++;
        });
        
        loserCards.forEach(card => {
            if (!this.data.cardStats[card.cardId]) {
                this.data.cardStats[card.cardId] = { name: card.cardName, type: card.cardType, aspect: card.aspect, played: 0, wins: 0, losses: 0 };
            }
            this.data.cardStats[card.cardId].played++;
            this.data.cardStats[card.cardId].losses++;
        });
        
        const archetype = this.detectArchetype(match.cardsPlayed.filter(c => c.player === match.winner));
        if (archetype) {
            if (!this.data.deckArchetypes[archetype]) {
                this.data.deckArchetypes[archetype] = { wins: 0, losses: 0, total: 0 };
            }
            this.data.deckArchetypes[archetype].wins++;
            this.data.deckArchetypes[archetype].total++;
        }
        
        this.data.matchHistory.push({
            matchId: match.matchId,
            timestamp: match.timestamp,
            winner: match.winner,
            player1Deity: match.player1Deity,
            player2Deity: match.player2Deity,
            turnCount: match.turnCount,
            matchMode: match.matchMode
        });
        
        if (this.data.matchHistory.length > 100) {
            this.data.matchHistory = this.data.matchHistory.slice(-100);
        }
        
        this.save();
    },
    
    detectArchetype(cardsPlayed) {
        const aspects = { Glow: 0, Void: 0, Gray: 0 };
        const types = { Avatar: 0, Spell: 0, Domain: 0 };
        
        cardsPlayed.forEach(card => {
            if (card.aspect) aspects[card.aspect]++;
            if (card.cardType) types[card.cardType]++;
        });
        
        const dominantAspect = Object.entries(aspects).sort((a, b) => b[1] - a[1])[0];
        const dominantType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
        
        if (dominantAspect[1] >= 3) {
            if (dominantType[0] === 'Spell' && types.Spell >= 3) return `${dominantAspect[0]} Control`;
            if (dominantType[0] === 'Avatar' && types.Avatar >= 4) return `${dominantAspect[0]} Aggro`;
            return `${dominantAspect[0]} Midrange`;
        }
        return 'Mixed';
    },
    
    getCardWinrate(cardId) {
        const stats = this.data.cardStats[cardId];
        if (!stats || stats.played === 0) return null;
        return {
            ...stats,
            winrate: Math.round((stats.wins / stats.played) * 100)
        };
    },
    
    getTopCards(limit = 10) {
        return Object.entries(this.data.cardStats)
            .map(([id, stats]) => ({ id, ...stats, winrate: stats.played > 0 ? (stats.wins / stats.played) * 100 : 0 }))
            .filter(c => c.played >= 3)
            .sort((a, b) => b.winrate - a.winrate)
            .slice(0, limit);
    },
    
    getArchetypeStats() {
        return Object.entries(this.data.deckArchetypes)
            .map(([name, stats]) => ({ name, ...stats, winrate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0 }))
            .sort((a, b) => b.total - a.total);
    },
    
    save() {
        localStorage.setItem('ec-analytics', JSON.stringify(this.data));
    },
    
    export() {
        return JSON.stringify(this.data, null, 2);
    }
};

const ReplayViewer = {
    currentReplay: null,
    currentActionIndex: 0,
    currentSnapshotIndex: 0,
    isPlaying: false,
    playbackSpeed: 1000,
    playbackInterval: null,
    
    loadReplay(matchId) {
        const replay = MatchRecorder.getReplay(matchId);
        if (!replay) {
            alert('Replay not found');
            return false;
        }
        
        this.currentReplay = replay;
        this.currentActionIndex = 0;
        this.currentSnapshotIndex = 0;
        this.isPlaying = false;
        
        Game.state.isReplayMode = true;
        Game.state.isSpectatorMode = false;
        
        this.renderReplayUI();
        this.applySnapshot(0);
        return true;
    },
    
    renderReplayUI() {
        document.getElementById('replay-overlay').classList.remove('hidden');
        document.getElementById('game-board').classList.add('replay-mode');
        
        const info = document.getElementById('replay-info');
        info.innerHTML = `
            <span class="replay-title">REPLAY: ${this.currentReplay.player1Deity} vs ${this.currentReplay.player2Deity}</span>
            <span class="replay-date">${new Date(this.currentReplay.timestamp).toLocaleDateString()}</span>
        `;
        
        this.updateControls();
    },
    
    updateControls() {
        const progress = document.getElementById('replay-progress');
        const turnDisplay = document.getElementById('replay-turn');
        const actionDisplay = document.getElementById('replay-action');
        
        if (!this.currentReplay) return;
        
        const snapshot = this.currentReplay.stateSnapshots[this.currentSnapshotIndex];
        const maxSnapshots = this.currentReplay.stateSnapshots.length - 1;
        
        progress.value = this.currentSnapshotIndex;
        progress.max = maxSnapshots;
        
        turnDisplay.textContent = `Turn ${snapshot?.turnNumber || 1} - ${snapshot?.currentPhase || 'main'}`;
        actionDisplay.textContent = `Snapshot ${this.currentSnapshotIndex + 1} / ${this.currentReplay.stateSnapshots.length}`;
        
        document.getElementById('btn-replay-play').textContent = this.isPlaying ? '⏸' : '▶';
    },
    
    applySnapshot(index) {
        if (!this.currentReplay || index < 0 || index >= this.currentReplay.stateSnapshots.length) return;
        
        this.currentSnapshotIndex = index;
        const snapshot = this.currentReplay.stateSnapshots[index];
        
        snapshot.players.forEach((pData, pIndex) => {
            const prefix = pIndex === 0 ? 'p1' : 'p2';
            document.getElementById(`${prefix}-essence`).textContent = pData.essence;
            document.getElementById(`${prefix}-kl`).textContent = `${pData.klCurrent}/${pData.klMax}`;
            document.getElementById(`${prefix}-deck-count`).textContent = pData.deckCount;
            document.getElementById(`${prefix}-grave-count`).textContent = pData.graveyardCount;
            
            const avatarRow = document.getElementById(`${prefix}-avatar-row`);
            avatarRow.innerHTML = '';
            pData.avatarRow.forEach(card => {
                const el = document.createElement('div');
                el.className = `card mini-card ${card.tapped ? 'tapped' : ''}`;
                el.innerHTML = `<div class="card-name">${card.name}</div><div class="card-stats">${card.attack}/${card.health}</div>`;
                avatarRow.appendChild(el);
            });
        });
        
        this.updateControls();
    },
    
    play() {
        if (this.isPlaying) {
            this.pause();
            return;
        }
        
        this.isPlaying = true;
        this.updateControls();
        
        this.playbackInterval = setInterval(() => {
            if (this.currentSnapshotIndex < this.currentReplay.stateSnapshots.length - 1) {
                this.stepForward();
            } else {
                this.pause();
            }
        }, this.playbackSpeed);
    },
    
    pause() {
        this.isPlaying = false;
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
        this.updateControls();
    },
    
    stepForward() {
        if (this.currentSnapshotIndex < this.currentReplay.stateSnapshots.length - 1) {
            this.applySnapshot(this.currentSnapshotIndex + 1);
        }
    },
    
    stepBackward() {
        if (this.currentSnapshotIndex > 0) {
            this.applySnapshot(this.currentSnapshotIndex - 1);
        }
    },
    
    jumpToTurn(turnNumber) {
        const snapshot = this.currentReplay.stateSnapshots.find(s => s.turnNumber === turnNumber);
        if (snapshot) {
            this.applySnapshot(this.currentReplay.stateSnapshots.indexOf(snapshot));
        }
    },
    
    seekTo(snapshotIndex) {
        this.applySnapshot(parseInt(snapshotIndex));
    },
    
    close() {
        this.pause();
        this.currentReplay = null;
        Game.state.isReplayMode = false;
        document.getElementById('replay-overlay').classList.add('hidden');
        document.getElementById('game-board').classList.remove('replay-mode');
    }
};

const SpectatorMode = {
    isSpectating: false,
    currentMatchId: null,
    updateInterval: null,
    spectatorDelay: 5000,
    
    startSpectating(matchId) {
        const liveMatch = MatchRecorder.liveMatches.find(m => m.matchId === matchId);
        if (!liveMatch) {
            alert('Match not found or already ended');
            return false;
        }
        
        this.isSpectating = true;
        this.currentMatchId = matchId;
        
        Game.state.isSpectatorMode = true;
        Game.state.isReplayMode = false;
        
        document.getElementById('spectator-overlay').classList.remove('hidden');
        document.getElementById('game-board').classList.add('spectator-mode');
        
        document.getElementById('spectator-info').innerHTML = `
            <span class="spectator-badge">👁 SPECTATING</span>
            <span class="spectator-match">${liveMatch.player1Deity} vs ${liveMatch.player2Deity}</span>
            <span class="spectator-delay">(${this.spectatorDelay / 1000}s delay)</span>
        `;
        
        this.startUpdates();
        return true;
    },
    
    startUpdates() {
        this.updateInterval = setInterval(() => {
            this.fetchLatestState();
        }, 2000);
    },
    
    fetchLatestState() {
        if (!MatchRecorder.currentMatch) {
            this.stopSpectating();
            return;
        }
        
        const snapshots = MatchRecorder.currentMatch.stateSnapshots;
        if (snapshots.length > 0) {
            const delayedIndex = Math.max(0, snapshots.length - Math.ceil(this.spectatorDelay / 2000));
            const snapshot = snapshots[delayedIndex];
            this.applySpectatorSnapshot(snapshot);
        }
    },
    
    applySpectatorSnapshot(snapshot) {
        if (!snapshot) return;
        
        document.getElementById('spectator-turn').textContent = `Turn ${snapshot.turnNumber} - ${snapshot.currentPhase}`;
        
        snapshot.players.forEach((pData, pIndex) => {
            const prefix = pIndex === 0 ? 'p1' : 'p2';
            document.getElementById(`${prefix}-essence`).textContent = pData.essence;
            document.getElementById(`${prefix}-kl`).textContent = `${pData.klCurrent}/${pData.klMax}`;
        });
    },
    
    stopSpectating() {
        this.isSpectating = false;
        this.currentMatchId = null;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        Game.state.isSpectatorMode = false;
        document.getElementById('spectator-overlay').classList.add('hidden');
        document.getElementById('game-board').classList.remove('spectator-mode');
    }
};

const Matchmaking = {
    queues: {
        casual: [],
        ranked: []
    },
    playerProfile: {
        playerId: 'player-' + Math.random().toString(36).substr(2, 9),
        username: 'Player' + Math.floor(Math.random() * 1000),
        mmr: parseInt(localStorage.getItem('ec-player-mmr') || '1000'),
        seasonId: 1,
        tier: 'Bronze',
        tieBreaker: 0,
        gamesPlayedThisSeason: 0,
        highestTierThisSeason: 'Bronze',
        wins: 0,
        losses: 0,
        lastUpdated: Date.now()
    },
    friends: JSON.parse(localStorage.getItem('ec-friends') || '[]'),
    friendRequests: JSON.parse(localStorage.getItem('ec-friend-requests') || '[]'),
    addFriend(username) {
        if (!this.friends.includes(username) && username !== this.playerProfile.username) {
            this.friends.push(username);
            localStorage.setItem('ec-friends', JSON.stringify(this.friends));
            return true;
        }
        return false;
    },
    removeFriend(username) {
        this.friends = this.friends.filter(f => f !== username);
        localStorage.setItem('ec-friends', JSON.stringify(this.friends));
    },
    sendFriendRequest(username) {
        if (!this.friendRequests.includes(username) && username !== this.playerProfile.username) {
            this.friendRequests.push(username);
            localStorage.setItem('ec-friend-requests', JSON.stringify(this.friendRequests));
            return true;
        }
        return false;
    },
    acceptFriendRequest(username) {
        this.friendRequests = this.friendRequests.filter(r => r !== username);
        this.addFriend(username);
        localStorage.setItem('ec-friend-requests', JSON.stringify(this.friendRequests));
    },
    declineFriendRequest(username) {
        this.friendRequests = this.friendRequests.filter(r => r !== username);
        localStorage.setItem('ec-friend-requests', JSON.stringify(this.friendRequests));
    },
    getFriendStatus(username) {
        return Math.random() > 0.5 ? 'online' : 'offline';
    },
    tiers: ['Bronze III', 'Bronze II', 'Bronze I', 'Silver I', 'Silver II', 'Gold I', 'Gold II', 'Platinum I', 'Platinum II', 'Obsidian I', 'Obsidian II', 'Shattered Crown'],
    mmoToTier(mmr) {
        if (mmr < 1200) return { tier: 'Bronze', level: 'III', mmr };
        if (mmr < 1400) return { tier: 'Bronze', level: 'II', mmr };
        if (mmr < 1600) return { tier: 'Bronze', level: 'I', mmr };
        if (mmr < 1800) return { tier: 'Silver', level: 'I', mmr };
        if (mmr < 2000) return { tier: 'Silver', level: 'II', mmr };
        if (mmr < 2200) return { tier: 'Gold', level: 'I', mmr };
        if (mmr < 2400) return { tier: 'Gold', level: 'II', mmr };
        if (mmr < 2600) return { tier: 'Platinum', level: 'I', mmr };
        if (mmr < 2800) return { tier: 'Platinum', level: 'II', mmr };
        if (mmr < 3000) return { tier: 'Obsidian', level: 'I', mmr };
        if (mmr < 3200) return { tier: 'Obsidian', level: 'II', mmr };
        return { tier: 'Shattered Crown', level: 'I', mmr };
    },
    getTierDisplay() {
        const tierInfo = this.mmoToTier(this.playerProfile.mmr);
        return `${tierInfo.tier} ${tierInfo.level} (${this.playerProfile.mmr} MMR)`;
    },
    updateMMR(win) {
        const change = win ? 25 : -15;
        this.playerProfile.mmr = Math.max(800, this.playerProfile.mmr + change);
        this.playerProfile.gamesPlayedThisSeason++;
        if (win) this.playerProfile.wins++;
        else this.playerProfile.losses++;
        localStorage.setItem('ec-player-mmr', this.playerProfile.mmr);
    }
};

const EventManager = {
    events: JSON.parse(localStorage.getItem('ec-events') || '[]'),
    activeEvent: null,
    
    defaultEvents: [
        {
            id: 'void-dominion',
            name: 'Void Dominion',
            description: 'Only Void Aspect cards allowed. Embrace the darkness.',
            format: 'swiss',
            maxRounds: 3,
            rules: {
                allowedAspects: ['Void'],
                bannedTypes: [],
                startingEssence: 20,
                startingKL: 4,
                customRules: []
            },
            icon: '🌑',
            active: true
        },
        {
            id: 'glow-ascension',
            name: 'Glow Ascension',
            description: 'Only Glow Aspect cards. Radiate pure light.',
            format: 'swiss',
            maxRounds: 3,
            rules: {
                allowedAspects: ['Glow'],
                bannedTypes: [],
                startingEssence: 25,
                startingKL: 3,
                customRules: []
            },
            icon: '✨',
            active: true
        },
        {
            id: 'no-domains',
            name: 'Avatar Clash',
            description: 'Domains are banned. Pure creature combat.',
            format: 'elimination',
            maxRounds: 4,
            rules: {
                allowedAspects: ['Glow', 'Void', 'Gray'],
                bannedTypes: ['Domain'],
                startingEssence: 23,
                startingKL: 3,
                customRules: []
            },
            icon: '⚔️',
            active: true
        },
        {
            id: 'gray-tactics',
            name: 'Gray Tactics',
            description: 'Gray Aspect only. Balance is key.',
            format: 'swiss',
            maxRounds: 3,
            rules: {
                allowedAspects: ['Gray'],
                bannedTypes: [],
                startingEssence: 22,
                startingKL: 4,
                customRules: ['extraDraw']
            },
            icon: '⚖️',
            active: true
        },
        {
            id: 'spell-slinger',
            name: 'Spell Slinger',
            description: 'Avatars banned. Spell and Domain focus.',
            format: 'elimination',
            maxRounds: 3,
            rules: {
                allowedAspects: ['Glow', 'Void', 'Gray'],
                bannedTypes: ['Avatar'],
                startingEssence: 30,
                startingKL: 5,
                customRules: []
            },
            icon: '🔮',
            active: true
        }
    ],
    
    init() {
        if (this.events.length === 0) {
            this.events = [...this.defaultEvents];
            this.save();
        }
    },
    
    save() {
        localStorage.setItem('ec-events', JSON.stringify(this.events));
    },
    
    getActiveEvents() {
        return this.events.filter(e => e.active);
    },
    
    getEvent(eventId) {
        return this.events.find(e => e.id === eventId);
    },
    
    setActiveEvent(eventId) {
        this.activeEvent = this.getEvent(eventId);
        return this.activeEvent;
    },
    
    clearActiveEvent() {
        this.activeEvent = null;
    },
    
    isCardAllowed(card) {
        if (!this.activeEvent) return true;
        const rules = this.activeEvent.rules;
        
        if (rules.allowedAspects.length > 0 && card.aspect) {
            if (!rules.allowedAspects.includes(card.aspect)) return false;
        }
        if (rules.bannedTypes.length > 0 && card.type) {
            if (rules.bannedTypes.includes(card.type)) return false;
        }
        return true;
    },
    
    getStartingEssence() {
        return this.activeEvent?.rules?.startingEssence || 23;
    },
    
    getStartingKL() {
        return this.activeEvent?.rules?.startingKL || 3;
    },
    
    hasCustomRule(rule) {
        return this.activeEvent?.rules?.customRules?.includes(rule) || false;
    },
    
    createEvent(eventData) {
        const newEvent = {
            id: 'event-' + Date.now(),
            name: eventData.name,
            description: eventData.description,
            format: eventData.format || 'swiss',
            maxRounds: eventData.maxRounds || 3,
            rules: {
                allowedAspects: eventData.allowedAspects || ['Glow', 'Void', 'Gray'],
                bannedTypes: eventData.bannedTypes || [],
                startingEssence: eventData.startingEssence || 23,
                startingKL: eventData.startingKL || 3,
                customRules: eventData.customRules || []
            },
            icon: eventData.icon || '🎮',
            active: true
        };
        this.events.push(newEvent);
        this.save();
        return newEvent;
    }
};

const TournamentManager = {
    tournaments: JSON.parse(localStorage.getItem('ec-tournaments') || '[]'),
    activeTournament: null,
    currentMatch: null,
    
    save() {
        localStorage.setItem('ec-tournaments', JSON.stringify(this.tournaments));
    },
    
    createTournament(options) {
        const tournament = {
            id: 'tourney-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: options.name || 'Shard Wars Tournament',
            format: options.format || 'swiss',
            maxPlayers: options.maxPlayers || 8,
            currentRound: 0,
            maxRounds: options.maxRounds || (options.format === 'elimination' ? Math.ceil(Math.log2(options.maxPlayers || 8)) : 3),
            status: 'registration',
            eventId: options.eventId || null,
            players: [],
            rounds: [],
            standings: [],
            createdAt: Date.now(),
            startedAt: null,
            endedAt: null
        };
        
        this.tournaments.unshift(tournament);
        if (this.tournaments.length > 20) this.tournaments.pop();
        this.save();
        return tournament;
    },
    
    getTournament(tournamentId) {
        return this.tournaments.find(t => t.id === tournamentId);
    },
    
    getOpenTournaments() {
        return this.tournaments.filter(t => t.status === 'registration');
    },
    
    getActiveTournaments() {
        return this.tournaments.filter(t => t.status === 'active');
    },
    
    registerPlayer(tournamentId, player) {
        const tournament = this.getTournament(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };
        if (tournament.status !== 'registration') return { success: false, error: 'Registration closed' };
        if (tournament.players.length >= tournament.maxPlayers) return { success: false, error: 'Tournament full' };
        if (tournament.players.find(p => p.playerId === player.playerId)) {
            return { success: false, error: 'Already registered' };
        }
        
        tournament.players.push({
            playerId: player.playerId,
            username: player.username,
            mmr: player.mmr || 1000,
            wins: 0,
            losses: 0,
            draws: 0,
            gameWins: 0,
            gameLosses: 0,
            matchPoints: 0,
            opponentWinRate: 0,
            dropped: false,
            seed: tournament.players.length + 1
        });
        
        this.save();
        return { success: true, tournament };
    },
    
    unregisterPlayer(tournamentId, playerId) {
        const tournament = this.getTournament(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };
        if (tournament.status !== 'registration') return { success: false, error: 'Cannot unregister after start' };
        
        tournament.players = tournament.players.filter(p => p.playerId !== playerId);
        this.save();
        return { success: true };
    },
    
    startTournament(tournamentId) {
        const tournament = this.getTournament(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };
        if (tournament.players.length < 2) return { success: false, error: 'Need at least 2 players' };
        
        tournament.status = 'active';
        tournament.startedAt = Date.now();
        tournament.currentRound = 1;
        
        this.shufflePlayers(tournament);
        
        if (tournament.format === 'swiss') {
            this.generateSwissRound(tournament);
        } else {
            this.generateEliminationBracket(tournament);
        }
        
        this.save();
        return { success: true, tournament };
    },
    
    shufflePlayers(tournament) {
        for (let i = tournament.players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tournament.players[i], tournament.players[j]] = [tournament.players[j], tournament.players[i]];
        }
        tournament.players.forEach((p, idx) => p.seed = idx + 1);
    },
    
    generateSwissRound(tournament) {
        const activePlayers = tournament.players.filter(p => !p.dropped);
        
        activePlayers.sort((a, b) => {
            if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
            return b.opponentWinRate - a.opponentWinRate;
        });
        
        const round = {
            roundNumber: tournament.currentRound,
            matches: [],
            completed: false
        };
        
        const paired = new Set();
        const previousOpponents = this.getPreviousOpponents(tournament);
        
        for (let i = 0; i < activePlayers.length; i++) {
            if (paired.has(activePlayers[i].playerId)) continue;
            
            for (let j = i + 1; j < activePlayers.length; j++) {
                if (paired.has(activePlayers[j].playerId)) continue;
                
                const prevOpps = previousOpponents[activePlayers[i].playerId] || [];
                if (!prevOpps.includes(activePlayers[j].playerId)) {
                    round.matches.push({
                        matchId: `${tournament.id}-r${tournament.currentRound}-m${round.matches.length + 1}`,
                        player1: activePlayers[i].playerId,
                        player2: activePlayers[j].playerId,
                        player1Name: activePlayers[i].username,
                        player2Name: activePlayers[j].username,
                        result: null,
                        winner: null,
                        reported: false
                    });
                    paired.add(activePlayers[i].playerId);
                    paired.add(activePlayers[j].playerId);
                    break;
                }
            }
        }
        
        const unpaired = activePlayers.filter(p => !paired.has(p.playerId));
        if (unpaired.length === 1) {
            round.matches.push({
                matchId: `${tournament.id}-r${tournament.currentRound}-bye`,
                player1: unpaired[0].playerId,
                player2: 'BYE',
                player1Name: unpaired[0].username,
                player2Name: 'BYE',
                result: '2-0',
                winner: unpaired[0].playerId,
                reported: true,
                isBye: true
            });
            unpaired[0].matchPoints += 3;
            unpaired[0].wins++;
        }
        
        tournament.rounds.push(round);
    },
    
    generateEliminationBracket(tournament) {
        const players = [...tournament.players];
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(players.length)));
        
        while (players.length < bracketSize) {
            players.push({ playerId: 'BYE', username: 'BYE', isBye: true });
        }
        
        const round = {
            roundNumber: tournament.currentRound,
            matches: [],
            completed: false
        };
        
        for (let i = 0; i < players.length; i += 2) {
            const p1 = players[i];
            const p2 = players[i + 1];
            
            const match = {
                matchId: `${tournament.id}-r${tournament.currentRound}-m${round.matches.length + 1}`,
                player1: p1.playerId,
                player2: p2.playerId,
                player1Name: p1.username,
                player2Name: p2.username,
                result: null,
                winner: null,
                reported: false,
                bracketPosition: round.matches.length
            };
            
            if (p2.isBye) {
                match.result = 'BYE';
                match.winner = p1.playerId;
                match.reported = true;
                const player = tournament.players.find(pl => pl.playerId === p1.playerId);
                if (player) player.wins++;
            } else if (p1.isBye) {
                match.result = 'BYE';
                match.winner = p2.playerId;
                match.reported = true;
                const player = tournament.players.find(pl => pl.playerId === p2.playerId);
                if (player) player.wins++;
            }
            
            round.matches.push(match);
        }
        
        tournament.rounds.push(round);
    },
    
    getPreviousOpponents(tournament) {
        const opponents = {};
        tournament.rounds.forEach(round => {
            round.matches.forEach(match => {
                if (match.player2 !== 'BYE') {
                    if (!opponents[match.player1]) opponents[match.player1] = [];
                    if (!opponents[match.player2]) opponents[match.player2] = [];
                    opponents[match.player1].push(match.player2);
                    opponents[match.player2].push(match.player1);
                }
            });
        });
        return opponents;
    },
    
    reportMatchResult(tournamentId, matchId, winnerId, result) {
        const tournament = this.getTournament(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };
        
        const currentRound = tournament.rounds[tournament.currentRound - 1];
        if (!currentRound) return { success: false, error: 'Round not found' };
        
        const match = currentRound.matches.find(m => m.matchId === matchId);
        if (!match) return { success: false, error: 'Match not found' };
        if (match.reported) return { success: false, error: 'Match already reported' };
        
        match.winner = winnerId;
        match.result = result;
        match.reported = true;
        
        const winner = tournament.players.find(p => p.playerId === winnerId);
        const loserId = match.player1 === winnerId ? match.player2 : match.player1;
        const loser = tournament.players.find(p => p.playerId === loserId);
        
        if (winner) {
            winner.wins++;
            winner.matchPoints += 3;
        }
        if (loser && loser.playerId !== 'BYE') {
            loser.losses++;
        }
        
        const allReported = currentRound.matches.every(m => m.reported);
        if (allReported) {
            currentRound.completed = true;
            this.advanceRound(tournament);
        }
        
        this.save();
        return { success: true, tournament };
    },
    
    advanceRound(tournament) {
        if (tournament.format === 'swiss') {
            if (tournament.currentRound >= tournament.maxRounds) {
                this.endTournament(tournament);
            } else {
                tournament.currentRound++;
                this.updateOpponentWinRates(tournament);
                this.generateSwissRound(tournament);
            }
        } else {
            const lastRound = tournament.rounds[tournament.rounds.length - 1];
            const winners = lastRound.matches.map(m => m.winner).filter(w => w && w !== 'BYE');
            
            if (winners.length === 1) {
                this.endTournament(tournament);
            } else {
                tournament.currentRound++;
                const round = {
                    roundNumber: tournament.currentRound,
                    matches: [],
                    completed: false
                };
                
                for (let i = 0; i < winners.length; i += 2) {
                    const p1 = tournament.players.find(p => p.playerId === winners[i]);
                    const p2 = winners[i + 1] ? tournament.players.find(p => p.playerId === winners[i + 1]) : null;
                    
                    round.matches.push({
                        matchId: `${tournament.id}-r${tournament.currentRound}-m${round.matches.length + 1}`,
                        player1: p1.playerId,
                        player2: p2 ? p2.playerId : 'BYE',
                        player1Name: p1.username,
                        player2Name: p2 ? p2.username : 'BYE',
                        result: p2 ? null : 'BYE',
                        winner: p2 ? null : p1.playerId,
                        reported: !p2,
                        bracketPosition: round.matches.length
                    });
                }
                
                tournament.rounds.push(round);
            }
        }
    },
    
    updateOpponentWinRates(tournament) {
        const opponents = this.getPreviousOpponents(tournament);
        
        tournament.players.forEach(player => {
            const opps = opponents[player.playerId] || [];
            if (opps.length === 0) {
                player.opponentWinRate = 0;
                return;
            }
            
            let totalWinRate = 0;
            opps.forEach(oppId => {
                const opp = tournament.players.find(p => p.playerId === oppId);
                if (opp) {
                    const games = opp.wins + opp.losses;
                    totalWinRate += games > 0 ? opp.wins / games : 0.5;
                }
            });
            player.opponentWinRate = totalWinRate / opps.length;
        });
    },
    
    endTournament(tournament) {
        tournament.status = 'completed';
        tournament.endedAt = Date.now();
        
        tournament.standings = [...tournament.players]
            .filter(p => !p.dropped)
            .sort((a, b) => {
                if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
                if (b.opponentWinRate !== a.opponentWinRate) return b.opponentWinRate - a.opponentWinRate;
                return b.gameWins - a.gameWins;
            })
            .map((p, idx) => ({ ...p, finalRank: idx + 1 }));
        
        this.save();
    },
    
    getStandings(tournamentId) {
        const tournament = this.getTournament(tournamentId);
        if (!tournament) return [];
        
        if (tournament.status === 'completed') return tournament.standings;
        
        return [...tournament.players]
            .filter(p => !p.dropped)
            .sort((a, b) => {
                if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
                if (b.opponentWinRate !== a.opponentWinRate) return b.opponentWinRate - a.opponentWinRate;
                return b.wins - a.wins;
            })
            .map((p, idx) => ({ ...p, currentRank: idx + 1 }));
    },
    
    getCurrentMatches(tournamentId) {
        const tournament = this.getTournament(tournamentId);
        if (!tournament || tournament.status !== 'active') return [];
        
        const currentRound = tournament.rounds[tournament.currentRound - 1];
        return currentRound ? currentRound.matches : [];
    },
    
    getPlayerMatch(tournamentId, playerId) {
        const matches = this.getCurrentMatches(tournamentId);
        return matches.find(m => 
            (m.player1 === playerId || m.player2 === playerId) && !m.reported
        );
    },
    
    dropPlayer(tournamentId, playerId) {
        const tournament = this.getTournament(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };
        
        const player = tournament.players.find(p => p.playerId === playerId);
        if (player) {
            player.dropped = true;
            this.save();
            return { success: true };
        }
        return { success: false, error: 'Player not found' };
    },
    
    setActiveTournament(tournamentId) {
        this.activeTournament = this.getTournament(tournamentId);
        return this.activeTournament;
    }
};

const LimitedMode = {
    currentPool: [],
    currentDeck: [],
    sealedActive: false,
    draftActive: false,
    draftPacks: [],
    draftPickHistory: [],
    
    rarityWeights: {
        'Mythic': 1,
        'Arcane': 3,
        'Master': 8,
        'Adept': 20,
        'Shard': 35
    },
    
    sealedConfig: {
        poolSize: 45,
        minDeckSize: 30,
        maxDeckSize: 40,
        guaranteedMythic: 1,
        guaranteedArcane: 2,
        guaranteedMaster: 5
    },
    
    draftConfig: {
        packSize: 15,
        packCount: 3,
        pickTime: 45
    },
    
    init() {
        const saved = localStorage.getItem('ec-limited-state');
        if (saved) {
            const state = JSON.parse(saved);
            this.currentPool = state.pool || [];
            this.currentDeck = state.deck || [];
            this.sealedActive = state.sealedActive || false;
        }
    },
    
    save() {
        localStorage.setItem('ec-limited-state', JSON.stringify({
            pool: this.currentPool,
            deck: this.currentDeck,
            sealedActive: this.sealedActive
        }));
    },
    
    generateSealedPool() {
        const pool = [];
        const nonDeityCards = ALL_CARDS.filter(c => c.type !== 'Deity');
        
        const mythics = nonDeityCards.filter(c => c.rarity === 'Mythic');
        const arcanes = nonDeityCards.filter(c => c.rarity === 'Arcane');
        const masters = nonDeityCards.filter(c => c.rarity === 'Master');
        const adepts = nonDeityCards.filter(c => c.rarity === 'Adept');
        const shards = nonDeityCards.filter(c => c.rarity === 'Shard');
        
        for (let i = 0; i < this.sealedConfig.guaranteedMythic && mythics.length > 0; i++) {
            const idx = Math.floor(Math.random() * mythics.length);
            pool.push({ ...mythics[idx], instanceId: 'sealed-' + Date.now() + '-' + pool.length });
        }
        
        for (let i = 0; i < this.sealedConfig.guaranteedArcane && arcanes.length > 0; i++) {
            const idx = Math.floor(Math.random() * arcanes.length);
            pool.push({ ...arcanes[idx], instanceId: 'sealed-' + Date.now() + '-' + pool.length });
        }
        
        for (let i = 0; i < this.sealedConfig.guaranteedMaster && masters.length > 0; i++) {
            const idx = Math.floor(Math.random() * masters.length);
            pool.push({ ...masters[idx], instanceId: 'sealed-' + Date.now() + '-' + pool.length });
        }
        
        while (pool.length < this.sealedConfig.poolSize) {
            const card = this.weightedRandomCard(nonDeityCards);
            if (card) {
                pool.push({ ...card, instanceId: 'sealed-' + Date.now() + '-' + pool.length });
            }
        }
        
        this.currentPool = pool;
        this.currentDeck = [];
        this.sealedActive = true;
        this.save();
        return pool;
    },
    
    weightedRandomCard(cards) {
        const totalWeight = cards.reduce((sum, c) => sum + (this.rarityWeights[c.rarity] || 10), 0);
        let random = Math.random() * totalWeight;
        
        for (const card of cards) {
            random -= (this.rarityWeights[card.rarity] || 10);
            if (random <= 0) return card;
        }
        return cards[Math.floor(Math.random() * cards.length)];
    },
    
    addToDeck(cardInstanceId) {
        if (this.currentDeck.length >= this.sealedConfig.maxDeckSize) {
            return { success: false, error: 'Deck is at maximum size' };
        }
        
        const cardIndex = this.currentPool.findIndex(c => c.instanceId === cardInstanceId);
        if (cardIndex === -1) {
            return { success: false, error: 'Card not in pool' };
        }
        
        const card = this.currentPool.splice(cardIndex, 1)[0];
        this.currentDeck.push(card);
        this.save();
        return { success: true };
    },
    
    removeFromDeck(cardInstanceId) {
        const cardIndex = this.currentDeck.findIndex(c => c.instanceId === cardInstanceId);
        if (cardIndex === -1) {
            return { success: false, error: 'Card not in deck' };
        }
        
        const card = this.currentDeck.splice(cardIndex, 1)[0];
        this.currentPool.push(card);
        this.save();
        return { success: true };
    },
    
    isDeckValid() {
        return this.currentDeck.length >= this.sealedConfig.minDeckSize && 
               this.currentDeck.length <= this.sealedConfig.maxDeckSize;
    },
    
    getDeckForGame() {
        if (!this.isDeckValid()) return null;
        return this.currentDeck.map(c => ({ ...c }));
    },
    
    endSealed() {
        this.currentPool = [];
        this.currentDeck = [];
        this.sealedActive = false;
        this.save();
    },
    
    generateDraftPack() {
        const pack = [];
        const nonDeityCards = ALL_CARDS.filter(c => c.type !== 'Deity');
        
        const mythics = nonDeityCards.filter(c => c.rarity === 'Mythic' || c.rarity === 'Arcane');
        if (mythics.length > 0 && Math.random() < 0.15) {
            const idx = Math.floor(Math.random() * mythics.length);
            pack.push({ ...mythics[idx], instanceId: 'draft-' + Date.now() + '-' + pack.length });
        }
        
        while (pack.length < this.draftConfig.packSize) {
            const card = this.weightedRandomCard(nonDeityCards);
            if (card) {
                pack.push({ ...card, instanceId: 'draft-' + Date.now() + '-' + pack.length });
            }
        }
        
        return pack;
    },
    
    initDraft() {
        this.draftPacks = [];
        this.draftPickHistory = [];
        this.currentDeck = [];
        this.draftActive = true;
        
        for (let i = 0; i < this.draftConfig.packCount; i++) {
            this.draftPacks.push(this.generateDraftPack());
        }
        
        this.save();
        return this.draftPacks[0];
    },
    
    makeDraftPick(cardInstanceId, currentPackIndex) {
        const pack = this.draftPacks[currentPackIndex];
        if (!pack) return { success: false, error: 'Invalid pack' };
        
        const cardIndex = pack.findIndex(c => c.instanceId === cardInstanceId);
        if (cardIndex === -1) return { success: false, error: 'Card not in pack' };
        
        const card = pack.splice(cardIndex, 1)[0];
        this.currentDeck.push(card);
        this.draftPickHistory.push(card.id);
        this.save();
        
        return { 
            success: true, 
            nextPack: pack.length > 0 ? pack : (this.draftPacks[currentPackIndex + 1] || null),
            packIndex: pack.length > 0 ? currentPackIndex : currentPackIndex + 1,
            draftComplete: currentPackIndex >= this.draftConfig.packCount - 1 && pack.length === 0
        };
    }
};

const CosmeticsManager = {
    owned: JSON.parse(localStorage.getItem('ec-cosmetics-owned') || '{}'),
    equipped: JSON.parse(localStorage.getItem('ec-cosmetics-equipped') || '{}'),
    
    cosmeticTypes: {
        cardBack: {
            name: 'Card Backs',
            description: 'Customize the back of your cards'
        },
        deitySkin: {
            name: 'Deity Skins',
            description: 'Alternate appearances for your Deities'
        },
        boardSkin: {
            name: 'Board Skins',
            description: 'Change the New Earth battlefield appearance'
        },
        effectVariant: {
            name: 'Effect Variants',
            description: 'Customize spell and ability animations'
        },
        cardFrame: {
            name: 'Card Frames',
            description: 'Unique borders for your cards'
        }
    },
    
    allCosmetics: [
        { id: 'cb-default', type: 'cardBack', name: 'Standard Back', rarity: 'common', price: 0, owned: true, image: 'default' },
        { id: 'cb-void', type: 'cardBack', name: 'Void Eclipse', rarity: 'rare', price: 500, owned: false, image: 'void' },
        { id: 'cb-glow', type: 'cardBack', name: 'Solar Radiance', rarity: 'rare', price: 500, owned: false, image: 'glow' },
        { id: 'cb-gray', type: 'cardBack', name: 'Neutral Balance', rarity: 'rare', price: 500, owned: false, image: 'gray' },
        { id: 'cb-mythic', type: 'cardBack', name: 'Crown Essence', rarity: 'legendary', price: 1500, owned: false, image: 'mythic' },
        { id: 'cb-shattered', type: 'cardBack', name: 'Shattered Crown', rarity: 'mythic', price: 3000, owned: false, image: 'shattered' },
        
        { id: 'ds-herald-alt', type: 'deitySkin', name: 'Second Sun Herald - Eclipse Form', rarity: 'epic', price: 1000, owned: false, deityId: 'EC-001' },
        { id: 'ds-regent-alt', type: 'deitySkin', name: 'Null Regent - Corrupted', rarity: 'epic', price: 1000, owned: false, deityId: 'EC-002' },
        { id: 'ds-arbiter-alt', type: 'deitySkin', name: 'Crown Arbiter - Transcendent', rarity: 'legendary', price: 2000, owned: false, deityId: 'EC-036' },
        
        { id: 'bs-default', type: 'boardSkin', name: 'New Earth - Standard', rarity: 'common', price: 0, owned: true },
        { id: 'bs-void', type: 'boardSkin', name: 'New Earth - Void Realm', rarity: 'rare', price: 800, owned: false },
        { id: 'bs-glow', type: 'boardSkin', name: 'New Earth - Solar Temple', rarity: 'rare', price: 800, owned: false },
        { id: 'bs-cosmic', type: 'boardSkin', name: 'New Earth - Cosmic Expanse', rarity: 'legendary', price: 2000, owned: false },
        { id: 'bs-shattered', type: 'boardSkin', name: 'New Earth - Shattered Dimension', rarity: 'mythic', price: 4000, owned: false },
        
        { id: 'ev-default', type: 'effectVariant', name: 'Standard Effects', rarity: 'common', price: 0, owned: true },
        { id: 'ev-void', type: 'effectVariant', name: 'Void Tendrils', rarity: 'rare', price: 600, owned: false },
        { id: 'ev-glow', type: 'effectVariant', name: 'Solar Flares', rarity: 'rare', price: 600, owned: false },
        { id: 'ev-cosmic', type: 'effectVariant', name: 'Cosmic Particles', rarity: 'legendary', price: 1500, owned: false },
        
        { id: 'cf-default', type: 'cardFrame', name: 'Standard Frame', rarity: 'common', price: 0, owned: true },
        { id: 'cf-gold', type: 'cardFrame', name: 'Golden Frame', rarity: 'rare', price: 400, owned: false },
        { id: 'cf-void', type: 'cardFrame', name: 'Void Border', rarity: 'rare', price: 400, owned: false },
        { id: 'cf-prismatic', type: 'cardFrame', name: 'Prismatic Edge', rarity: 'legendary', price: 1200, owned: false },
        { id: 'cf-crown', type: 'cardFrame', name: 'Crown Insignia', rarity: 'mythic', price: 2500, owned: false }
    ],
    
    init() {
        if (Object.keys(this.owned).length === 0) {
            this.allCosmetics.filter(c => c.price === 0).forEach(c => {
                this.owned[c.id] = true;
            });
            this.save();
        }
        
        if (!this.equipped.cardBack) {
            this.equipped = {
                cardBack: 'cb-default',
                deitySkin: {},
                boardSkin: 'bs-default',
                effectVariant: 'ev-default',
                cardFrame: 'cf-default'
            };
            this.saveEquipped();
        }
    },
    
    save() {
        localStorage.setItem('ec-cosmetics-owned', JSON.stringify(this.owned));
    },
    
    saveEquipped() {
        localStorage.setItem('ec-cosmetics-equipped', JSON.stringify(this.equipped));
    },
    
    getCosmetic(id) {
        return this.allCosmetics.find(c => c.id === id);
    },
    
    getCosmeticsByType(type) {
        return this.allCosmetics.filter(c => c.type === type);
    },
    
    isOwned(id) {
        return this.owned[id] === true;
    },
    
    purchase(id) {
        const cosmetic = this.getCosmetic(id);
        if (!cosmetic) return { success: false, error: 'Cosmetic not found' };
        if (this.isOwned(id)) return { success: false, error: 'Already owned' };
        
        const currency = ShardPath.getCurrency();
        if (currency < cosmetic.price) {
            return { success: false, error: 'Not enough Shards' };
        }
        
        ShardPath.spendCurrency(cosmetic.price);
        this.owned[id] = true;
        this.save();
        return { success: true, cosmetic };
    },
    
    equip(id) {
        const cosmetic = this.getCosmetic(id);
        if (!cosmetic) return { success: false, error: 'Cosmetic not found' };
        if (!this.isOwned(id)) return { success: false, error: 'Not owned' };
        
        if (cosmetic.type === 'deitySkin') {
            this.equipped.deitySkin[cosmetic.deityId] = id;
        } else {
            this.equipped[cosmetic.type] = id;
        }
        
        this.saveEquipped();
        return { success: true };
    },
    
    getEquipped(type, deityId = null) {
        if (type === 'deitySkin' && deityId) {
            return this.equipped.deitySkin[deityId] || null;
        }
        return this.equipped[type] || null;
    },
    
    getCardBackUrl() {
        const equipped = this.getEquipped('cardBack');
        const cosmetic = this.getCosmetic(equipped);
        if (cosmetic?.image === 'default') return CARD_BACK_URL;
        return CARD_BACK_URL;
    },
    
    getBoardClass() {
        const equipped = this.getEquipped('boardSkin');
        const cosmetic = this.getCosmetic(equipped);
        if (cosmetic) return `board-${cosmetic.image || 'default'}`;
        return 'board-default';
    },
    
    unlockCosmetic(id) {
        this.owned[id] = true;
        this.save();
    }
};

const RewardsSystem = {
    data: JSON.parse(localStorage.getItem('ec-rewards-data') || 'null') || {
        previousTier: 'Bronze III',
        highestTierReached: 'Bronze III',
        claimedTierRewards: [],
        totalShardsEarned: 0,
        rankUpsThisSeason: 0
    },
    
    tierRewards: {
        'Bronze III': { shards: 0, cosmetic: null, title: 'Initiate' },
        'Bronze II': { shards: 322, cosmetic: null, title: 'Bronze Aspirant' },
        'Bronze I': { shards: 422, cosmetic: 'cf-gold', title: 'Bronze Champion' },
        'Silver I': { shards: 522, cosmetic: 'cb-gray', title: 'Silver Initiate' },
        'Silver II': { shards: 722, cosmetic: 'ev-glow', title: 'Silver Adept' },
        'Gold I': { shards: 972, cosmetic: 'cb-glow', title: 'Gold Aspirant' },
        'Gold II': { shards: 1222, cosmetic: 'bs-glow', title: 'Gold Champion' },
        'Platinum I': { shards: 1722, cosmetic: 'cb-void', title: 'Platinum Initiate' },
        'Platinum II': { shards: 2222, cosmetic: 'ev-void', title: 'Platinum Master' },
        'Obsidian I': { shards: 3222, cosmetic: 'bs-void', title: 'Obsidian Adept' },
        'Obsidian II': { shards: 4222, cosmetic: 'ev-cosmic', title: 'Obsidian Lord' },
        'Shattered Crown I': { shards: 5222, cosmetic: 'cb-shattered', title: 'Shattered Crown' }
    },
    
    tierOrder: [
        'Bronze III', 'Bronze II', 'Bronze I',
        'Silver I', 'Silver II',
        'Gold I', 'Gold II',
        'Platinum I', 'Platinum II',
        'Obsidian I', 'Obsidian II',
        'Shattered Crown I'
    ],
    
    init() {
        this.loadData();
    },
    
    loadData() {
        const saved = localStorage.getItem('ec-rewards-data');
        if (saved) {
            this.data = { ...this.data, ...JSON.parse(saved) };
        }
    },
    
    save() {
        localStorage.setItem('ec-rewards-data', JSON.stringify(this.data));
    },
    
    getTierIndex(tierName) {
        return this.tierOrder.indexOf(tierName);
    },
    
    getCurrentTier() {
        const tierInfo = Matchmaking.mmoToTier(Matchmaking.playerProfile.mmr);
        return `${tierInfo.tier} ${tierInfo.level}`;
    },
    
    checkRankUp() {
        const currentTier = this.getCurrentTier();
        const previousTier = this.data.previousTier;
        const currentIndex = this.getTierIndex(currentTier);
        const previousIndex = this.getTierIndex(previousTier);
        
        if (currentIndex === -1 || previousIndex === -1) {
            this.data.previousTier = currentTier;
            this.save();
            return { rankedUp: false };
        }
        
        if (currentIndex > previousIndex) {
            if (this.data.claimedTierRewards.includes(currentTier)) {
                this.data.previousTier = currentTier;
                this.save();
                return { rankedUp: true, newTier: currentTier, rewards: { shards: 0, cosmetic: null, title: null, alreadyClaimed: true } };
            }
            
            const rewards = this.grantRankUpRewards(currentTier);
            this.data.previousTier = currentTier;
            this.data.rankUpsThisSeason++;
            
            if (currentIndex > this.getTierIndex(this.data.highestTierReached)) {
                this.data.highestTierReached = currentTier;
            }
            
            this.save();
            return { rankedUp: true, newTier: currentTier, rewards };
        }
        
        if (currentIndex < previousIndex) {
            this.data.previousTier = currentTier;
            this.save();
            return { rankedUp: false, demoted: true };
        }
        
        return { rankedUp: false };
    },
    
    grantRankUpRewards(tier) {
        if (this.data.claimedTierRewards.includes(tier)) {
            return { shards: 0, cosmetic: null, title: null, alreadyClaimed: true };
        }
        
        const reward = this.tierRewards[tier];
        if (!reward) return { shards: 0, cosmetic: null, title: null };
        
        const rewards = {
            shards: reward.shards || 0,
            cosmetic: null,
            title: reward.title || null
        };
        
        if (reward.shards > 0) {
            ShardPath.addCurrency(reward.shards);
            this.data.totalShardsEarned += reward.shards;
        }
        
        if (reward.cosmetic) {
            CosmeticsManager.unlockCosmetic(reward.cosmetic);
            rewards.cosmetic = CosmeticsManager.getCosmetic(reward.cosmetic);
        }
        
        if (reward.title) {
            PlayerProfile.unlockTitle(reward.title);
        }
        
        this.data.claimedTierRewards.push(tier);
        this.save();
        return rewards;
    },
    
    getMatchRewards(won, matchMode, difficulty = 'medium') {
        const baseRewards = {
            casual: { win: 237, loss: 227 },
            ranked: { win: 252, loss: 232 },
            tournament: { win: 272, loss: 242 },
            campaign: { win: 0, loss: 0 },
            tutorial: { win: 247, loss: 0 }
        };
        
        const aiBonus = {
            easy: 1,
            medium: 1.5,
            hard: 2,
            boss: 3
        };
        
        const mode = matchMode || 'casual';
        const base = baseRewards[mode] || baseRewards.casual;
        const amount = won ? base.win : base.loss;
        const multiplier = matchMode === 'ranked' ? 1 : (aiBonus[difficulty] || 1);
        
        return Math.floor(amount * multiplier);
    },
    
    showRankUpNotification(tier, rewards) {
        const notification = document.createElement('div');
        notification.className = 'rank-up-notification';
        notification.innerHTML = `
            <div class="rank-up-content">
                <div class="rank-up-glow"></div>
                <h2>RANK UP!</h2>
                <div class="new-rank">${tier}</div>
                <div class="rank-rewards">
                    ${rewards.shards > 0 ? `<div class="reward-item">💎 +${rewards.shards} Shards</div>` : ''}
                    ${rewards.cosmetic ? `<div class="reward-item">🎨 ${rewards.cosmetic.name}</div>` : ''}
                    ${rewards.title ? `<div class="reward-item">👑 Title: ${rewards.title}</div>` : ''}
                </div>
                <button onclick="this.parentElement.parentElement.remove()">Awesome!</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        BattleEffects.screenFlash('#d4af37', 500);
        BattleEffects.screenShake(5, 300);
        
        setTimeout(() => notification.remove(), 8000);
    }
};

const ShardPath = {
    data: JSON.parse(localStorage.getItem('ec-shard-path') || 'null') || {
        currentXP: 0,
        currentLevel: 1,
        maxLevel: 50,
        seasonNumber: 1,
        seasonName: 'Season of the Crown',
        seasonEnd: Date.now() + (90 * 24 * 60 * 60 * 1000),
        premiumUnlocked: false,
        claimedRewards: { free: [], premium: [] },
        currency: 500,
        dailyQuests: [],
        weeklyQuests: [],
        questResetTime: 0
    },
    
    xpPerLevel: 1000,
    xpPerMatch: 50,
    xpPerWin: 100,
    xpPerQuest: 200,
    
    rewards: {
        free: [
            { level: 1, type: "currency", amount: 322, name: '100 Shards' },
            { level: 3, type: 'cosmetic', id: 'cb-gray', name: 'Neutral Balance Card Back' },
            { level: 5, type: "currency", amount: 422, name: '200 Shards' },
            { level: 7, type: 'cosmetic', id: 'cf-gold', name: 'Golden Frame' },
            { level: 10, type: "currency", amount: 522, name: '300 Shards' },
            { level: 12, type: 'cosmetic', id: 'ev-glow', name: 'Solar Flares Effects' },
            { level: 15, type: "currency", amount: 622, name: '400 Shards' },
            { level: 18, type: 'cosmetic', id: 'cb-glow', name: 'Solar Radiance Card Back' },
            { level: 20, type: "currency", amount: 722, name: '500 Shards' },
            { level: 23, type: 'cosmetic', id: 'bs-glow', name: 'Solar Temple Board' },
            { level: 25, type: "currency", amount: 822, name: '600 Shards' },
            { level: 28, type: 'cosmetic', id: 'cf-void', name: 'Void Border Frame' },
            { level: 30, type: "currency", amount: 922, name: '700 Shards' },
            { level: 33, type: 'cosmetic', id: 'ev-void', name: 'Void Tendrils Effects' },
            { level: 35, type: "currency", amount: 1022, name: '800 Shards' },
            { level: 38, type: 'cosmetic', id: 'cb-void', name: 'Void Eclipse Card Back' },
            { level: 40, type: "currency", amount: 1222, name: '1000 Shards' },
            { level: 43, type: 'cosmetic', id: 'bs-void', name: 'Void Realm Board' },
            { level: 45, type: "currency", amount: 1422, name: '1200 Shards' },
            { level: 48, type: 'cosmetic', id: 'cf-prismatic', name: 'Prismatic Edge Frame' },
            { level: 50, type: "currency", amount: 2222, name: '2000 Shards' }
        ],
        premium: [
            { level: 1, type: "currency", amount: 422, name: "422 Shards" },
            { level: 2, type: 'cosmetic', id: 'ds-herald-alt', name: 'Second Sun Herald - Eclipse Form' },
            { level: 5, type: "currency", amount: 522, name: '300 Shards' },
            { level: 8, type: 'cosmetic', id: 'ds-regent-alt', name: 'Null Regent - Corrupted' },
            { level: 10, type: "currency", amount: 622, name: '400 Shards' },
            { level: 13, type: 'cosmetic', id: 'ev-cosmic', name: 'Cosmic Particles Effects' },
            { level: 15, type: "currency", amount: 722, name: '500 Shards' },
            { level: 18, type: 'cosmetic', id: 'cb-mythic', name: 'Crown Essence Card Back' },
            { level: 20, type: "currency", amount: 822, name: '600 Shards' },
            { level: 23, type: 'cosmetic', id: 'bs-cosmic', name: 'Cosmic Expanse Board' },
            { level: 25, type: 'currency', amount: 700, name: '700 Shards' },
            { level: 28, type: 'cosmetic', id: 'ds-arbiter-alt', name: 'Crown Arbiter - Transcendent' },
            { level: 30, type: 'currency', amount: 800, name: '800 Shards' },
            { level: 33, type: 'cosmetic', id: 'cf-crown', name: 'Crown Insignia Frame' },
            { level: 35, type: 'currency', amount: 1000, name: '1000 Shards' },
            { level: 38, type: 'cosmetic', id: 'bs-shattered', name: 'Shattered Dimension Board' },
            { level: 40, type: 'currency', amount: 1500, name: '1500 Shards' },
            { level: 45, type: 'cosmetic', id: 'cb-shattered', name: 'Shattered Crown Card Back' },
            { level: 50, type: 'currency', amount: 3000, name: '3000 Shards + Exclusive Title' }
        ]
    },
    
    questTemplates: {
        daily: [
            { id: 'play-3', name: 'Daily Warrior', description: 'Play 3 matches', target: 3, xp: 150, type: 'matches' },
            { id: 'win-1', name: 'Victory!', description: 'Win 1 match', target: 1, xp: 100, type: 'wins' },
            { id: 'play-glow', name: 'Light Bearer', description: 'Play 5 Glow cards', target: 5, xp: 100, type: 'aspect', aspect: 'Glow' },
            { id: 'play-void', name: 'Void Walker', description: 'Play 5 Void cards', target: 5, xp: 100, type: 'aspect', aspect: 'Void' },
            { id: 'deal-damage', name: 'Aggressor', description: 'Deal 20 Essence damage', target: 20, xp: 120, type: 'damage' }
        ],
        weekly: [
            { id: 'win-7', name: 'Weekly Champion', description: 'Win 7 matches', target: 7, xp: 500, type: 'wins' },
            { id: 'play-15', name: 'Dedicated Player', description: 'Play 15 matches', target: 15, xp: 400, type: 'matches' },
            { id: 'tournament', name: 'Tournament Contender', description: 'Complete a tournament', target: 1, xp: 600, type: 'tournaments' }
        ]
    },
    
    init() {
        this.checkQuestReset();
        CosmeticsManager.init();
    },
    
    save() {
        localStorage.setItem('ec-shard-path', JSON.stringify(this.data));
    },
    
    checkQuestReset() {
        const now = Date.now();
        const lastReset = this.data.questResetTime;
        const oneDayMs = 24 * 60 * 60 * 1000;
        const oneWeekMs = 7 * oneDayMs;
        
        if (now - lastReset > oneDayMs || this.data.dailyQuests.length === 0) {
            this.generateDailyQuests();
        }
        
        if (now - lastReset > oneWeekMs || this.data.weeklyQuests.length === 0) {
            this.generateWeeklyQuests();
        }
    },
    
    generateDailyQuests() {
        const templates = [...this.questTemplates.daily];
        const selected = [];
        for (let i = 0; i < 3 && templates.length > 0; i++) {
            const idx = Math.floor(Math.random() * templates.length);
            const quest = { ...templates.splice(idx, 1)[0], progress: 0, completed: false, claimed: false };
            selected.push(quest);
        }
        this.data.dailyQuests = selected;
        this.data.questResetTime = Date.now();
        this.save();
    },
    
    generateWeeklyQuests() {
        const templates = [...this.questTemplates.weekly];
        const selected = [];
        for (let i = 0; i < 2 && templates.length > 0; i++) {
            const idx = Math.floor(Math.random() * templates.length);
            const quest = { ...templates.splice(idx, 1)[0], progress: 0, completed: false, claimed: false };
            selected.push(quest);
        }
        this.data.weeklyQuests = selected;
        this.save();
    },
    
    addXP(amount, source = 'match') {
        this.data.currentXP += amount;
        
        while (this.data.currentXP >= this.xpPerLevel && this.data.currentLevel < this.data.maxLevel) {
            this.data.currentXP -= this.xpPerLevel;
            this.data.currentLevel++;
        }
        
        this.save();
        return { level: this.data.currentLevel, xp: this.data.currentXP };
    },
    
    recordMatchResult(won, cardsPlayed = [], damageDealt = 0) {
        this.addXP(won ? this.xpPerWin : this.xpPerMatch);
        
        [...this.data.dailyQuests, ...this.data.weeklyQuests].forEach(quest => {
            if (quest.completed) return;
            
            switch (quest.type) {
                case 'matches':
                    quest.progress++;
                    break;
                case 'wins':
                    if (won) quest.progress++;
                    break;
                case 'aspect':
                    const aspectCards = cardsPlayed.filter(c => c.aspects?.includes(quest.aspect));
                    quest.progress += aspectCards.length;
                    break;
                case 'damage':
                    quest.progress += damageDealt;
                    break;
            }
            
            if (quest.progress >= quest.target) {
                quest.completed = true;
            }
        });
        
        this.save();
    },
    
    recordTournamentComplete() {
        this.data.weeklyQuests.forEach(quest => {
            if (quest.type === 'tournaments' && !quest.completed) {
                quest.progress++;
                if (quest.progress >= quest.target) quest.completed = true;
            }
        });
        this.save();
    },
    
    claimQuestReward(questId, isWeekly = false) {
        const questList = isWeekly ? this.data.weeklyQuests : this.data.dailyQuests;
        const quest = questList.find(q => q.id === questId);
        
        if (!quest || !quest.completed || quest.claimed) {
            return { success: false, error: 'Cannot claim this quest' };
        }
        
        quest.claimed = true;
        this.addXP(quest.xp);
        this.save();
        
        return { success: true, xp: quest.xp };
    },
    
    claimReward(level, isPremium = false) {
        const track = isPremium ? 'premium' : 'free';
        
        if (isPremium && !this.data.premiumUnlocked) {
            return { success: false, error: 'Premium track not unlocked' };
        }
        
        if (level > this.data.currentLevel) {
            return { success: false, error: 'Level not reached' };
        }
        
        if (this.data.claimedRewards[track].includes(level)) {
            return { success: false, error: 'Already claimed' };
        }
        
        const rewards = isPremium ? this.rewards.premium : this.rewards.free;
        const reward = rewards.find(r => r.level === level);
        
        if (!reward) {
            return { success: false, error: 'Reward not found' };
        }
        
        this.data.claimedRewards[track].push(level);
        
        if (reward.type === 'currency') {
            this.data.currency += reward.amount;
        } else if (reward.type === 'cosmetic') {
            CosmeticsManager.unlockCosmetic(reward.id);
        }
        
        this.save();
        return { success: true, reward };
    },
    
    unlockPremium() {
        this.data.premiumUnlocked = true;
        this.save();
        return { success: true };
    },
    
    getCurrency() {
        return this.data.currency;
    },
    
    addCurrency(amount) {
        this.data.currency += amount;
        this.save();
    },
    
    spendCurrency(amount) {
        if (this.data.currency < amount) return false;
        this.data.currency -= amount;
        this.save();
        return true;
    },
    
    getProgress() {
        return {
            level: this.data.currentLevel,
            xp: this.data.currentXP,
            xpRequired: this.xpPerLevel,
            percentage: (this.data.currentXP / this.xpPerLevel) * 100,
            premiumUnlocked: this.data.premiumUnlocked,
            seasonName: this.data.seasonName,
            seasonEnd: this.data.seasonEnd,
            currency: this.data.currency
        };
    },
    
    getRewardsAtLevel(level) {
        const free = this.rewards.free.find(r => r.level === level);
        const premium = this.rewards.premium.find(r => r.level === level);
        return { free, premium };
    },
    
    isRewardClaimed(level, isPremium = false) {
        const track = isPremium ? 'premium' : 'free';
        return this.data.claimedRewards[track].includes(level);
    },
    
    resetSeason() {
        this.data.currentXP = 0;
        this.data.currentLevel = 1;
        this.data.seasonNumber++;
        this.data.claimedRewards = { free: [], premium: [] };
        this.data.seasonEnd = Date.now() + (90 * 24 * 60 * 60 * 1000);
        this.data.premiumUnlocked = false;
        this.save();
    }
};

const Game = {
    state: {
        currentPlayer: 0,
        currentPhase: 'dawn',
        turnNumber: 1,
        drawsThisTurn: 0,
        cardsPlayedThisTurn: 0,
        spellsPlayedThisTurn: 0,
        hasAttackedThisGame: false,
        phases: ['dawn', 'draw', 'main', 'clash', 'twilight'],
        phaseNames: { 
            dawn: 'Dawn Phase', 
            draw: 'Draw Phase',
            main: 'Main Phase', 
            clash: 'Clash Phase', 
            twilight: 'Twilight Phase' 
        },
        phaseDescriptions: {
            dawn: 'Upkeep - restore KL, start-of-turn triggers',
            draw: 'Draw one card from your deck',
            main: 'Play cards, activate abilities, change positions',
            clash: 'Declare attacks and resolve combat',
            twilight: 'End-of-turn effects, pass turn'
        },
        rulesHelper: true,
        logVisible: false,
        settingsVisible: false,
        codexVisible: false,
        tutorialMode: false,
        tutorialStep: 0,
        zoomCard: null,
        matchMode: 'casual',
        isPrivateMatch: false,
        challengeFriend: null,
        matchId: null,
        isReplayMode: false,
        isSpectatorMode: false,
        sealedDeck: null,
        cardsPlayedThisMatch: [],
        damageDealtThisMatch: 0,
        isSandboxMode: false,
        customLobbySettings: null,
        playerName: 'Player',
        players: [
            { 
                essence: 23, klCurrent: 3, klMax: 3, overflow: 0, godCodeCharges: 1, godCodeUsed: false,
                deity: null, 
                hand: [], 
                deck: [], 
                graveyard: [], 
                banished: [],
                avatarRow: [],
                domainRow: [],
                relicRow: [],
                spellRow: [],
                passiveUsedThisTurn: false,
                hasDrawnThisTurn: false
            },
            { 
                essence: 23, klCurrent: 3, klMax: 3, overflow: 0, godCodeCharges: 1, godCodeUsed: false,
                deity: null, 
                hand: [], 
                deck: [], 
                graveyard: [], 
                banished: [],
                avatarRow: [],
                domainRow: [],
                relicRow: [],
                spellRow: [],
                passiveUsedThisTurn: false,
                hasDrawnThisTurn: false
            }
        ],
        selectedDeities: [],
        draggedCard: null,
        contextCard: null,
        cardIdCounter: 0,
        combat: {
            mode: null, // null | 'selectAttacker' | 'selectTarget' | 'declareBlockers' | 'resolving'
            selectedAttacker: null,
            selectedTarget: null,
            attackedThisTurn: [],
            summonedThisTurn: [],
            // === ESSENCE CROWN BATTLE ENGINE UPGRADES ===
            declaredAttackers: [], // Array of {card, targetType: 'deity'|'avatar', targetCard?}
            declaredBlockers: {}, // Map of attackerInstanceId -> blockerCard
            pendingCombatResolution: false,
            tempDamage: {}, // Map of instanceId -> accumulated damage this combat
            domainsPlayedThisTurn: 0, // Track domain plays per turn (limit 1)
            maxDomainsPerTurn: 1
        },
        spell: {
            mode: null,
            pendingSpell: null,
            targetType: null
        },
        shardChain: {
            active: false,
            links: [],
            priority: 0,
            passCount: 0
        },
        previewTimeout: null,
        gameOver: false,
        events: {
            ON_AVATAR_SUMMONED: [],
            ON_AVATAR_DESTROYED: [],
            ON_ATTACK_DECLARED: [],
            ON_ESSENCE_LOSS: [],
            ON_ESSENCE_GAIN: [],
            ON_CARD_DRAWN: [],
            ON_SPELL_CAST: [],
            ON_DEITY_ABILITY_USED: [],
            ON_TURN_START: [],
            ON_TURN_END: [],
            ON_PHASE_CHANGE: []
        }
    },

    init() {
        console.log('Initializing Essence Crown TCG...');
        AccessibilitySettings.init();
        EventManager.init();
        LimitedMode.init();
        ShardPath.init();
        CosmeticsManager.init();
        this.bindEvents();
        MainMenu.init();
        this.initAccessibilityUI();
    },
    
    initAccessibilityUI() {
        const textSize = document.getElementById('opt-text-size');
        const colorblind = document.getElementById('opt-colorblind');
        const lowFx = document.getElementById('opt-low-fx');
        const highContrast = document.getElementById('opt-high-contrast');
        const reduceMotion = document.getElementById('opt-reduce-motion');
        
        if (textSize) {
            textSize.value = AccessibilitySettings.get('textSize');
            textSize.onchange = () => AccessibilitySettings.set('textSize', textSize.value);
        }
        if (colorblind) {
            colorblind.value = AccessibilitySettings.get('colorblindMode');
            colorblind.onchange = () => AccessibilitySettings.set('colorblindMode', colorblind.value);
        }
        if (lowFx) {
            lowFx.classList.toggle('active', AccessibilitySettings.get('lowFxMode'));
            lowFx.onclick = () => {
                lowFx.classList.toggle('active');
                AccessibilitySettings.set('lowFxMode', lowFx.classList.contains('active'));
            };
        }
        if (highContrast) {
            highContrast.classList.toggle('active', AccessibilitySettings.get('highContrast'));
            highContrast.onclick = () => {
                highContrast.classList.toggle('active');
                AccessibilitySettings.set('highContrast', highContrast.classList.contains('active'));
            };
        }
        if (reduceMotion) {
            reduceMotion.classList.toggle('active', AccessibilitySettings.get('reduceMotion'));
            reduceMotion.onclick = () => {
                reduceMotion.classList.toggle('active');
                AccessibilitySettings.set('reduceMotion', reduceMotion.classList.contains('active'));
            };
        }
        
        const cardSearch = document.getElementById('sandbox-card-search');
        if (cardSearch) {
            cardSearch.oninput = () => this.searchSandboxCards(cardSearch.value);
        }
        
        const victorySelect = document.getElementById('lobby-victory');
        if (victorySelect) {
            victorySelect.onchange = () => {
                const avatarRow = document.getElementById('lobby-avatar-count-row');
                if (avatarRow) {
                    avatarRow.style.display = victorySelect.value === 'avatars' ? 'flex' : 'none';
                }
            };
        }
    },

    bindEvents() {
        const btnFullscreen = document.getElementById('btn-fullscreen');
        const btnSkip = document.getElementById('btn-skip-fullscreen');
        const btnQuickPlay = document.getElementById('btn-quick-play');
        
        if (btnFullscreen) btnFullscreen.onclick = () => this.requestFullscreen();
        if (btnSkip) btnSkip.onclick = () => this.hideFullscreenPrompt();
        if (btnQuickPlay) {
            btnQuickPlay.onclick = () => {
                document.getElementById('fullscreen-prompt')?.classList.add('hidden');
                this.state.matchMode = 'casual';
                this.showDeitySelection(0);
            };
        }
        
        const nextPhaseBtn = document.getElementById('btn-next-phase');
        const endTurnBtn = document.getElementById('btn-end-turn');
        const rulesBtn = document.getElementById('btn-rules-helper');
        const settingsBtn = document.getElementById('btn-settings');
        const logBtn = document.getElementById('btn-log');
        const codexBtn = document.getElementById('btn-codex');
        const tutorialBtn = document.getElementById('btn-tutorial');
        const replaysBtn = document.getElementById('btn-replays');
        const spectateBtn = document.getElementById('btn-spectate');
        const closeSettings = document.getElementById('close-settings');
        
        if (nextPhaseBtn) nextPhaseBtn.onclick = () => this.nextPhase();
        if (endTurnBtn) endTurnBtn.onclick = () => this.endTurn();
        if (rulesBtn) rulesBtn.onclick = () => this.toggleRulesHelper();
        if (settingsBtn) settingsBtn.onclick = () => this.toggleSettings();
        if (logBtn) logBtn.onclick = () => this.toggleLog();
        if (codexBtn) codexBtn.onclick = () => this.toggleCodex();
        if (tutorialBtn) tutorialBtn.onclick = () => this.startTutorial();
        if (replaysBtn) replaysBtn.onclick = () => this.showReplayBrowser();
        if (spectateBtn) spectateBtn.onclick = () => this.showSpectateBrowser();
        if (closeSettings) closeSettings.onclick = () => this.toggleSettings();
        
        document.querySelectorAll('.codex-tab').forEach(tab => {
            tab.onclick = () => this.switchCodexTab(tab.dataset.tab);
        });
        
        document.querySelectorAll('.mobile-tab').forEach(tab => {
            tab.onclick = () => this.switchMobilePanel(tab.dataset.panel);
        });
        
        const tutorialNext = document.getElementById('btn-tutorial-next');
        const tutorialPrev = document.getElementById('btn-tutorial-prev');
        const tutorialSkip = document.getElementById('btn-tutorial-skip');
        if (tutorialNext) tutorialNext.onclick = () => this.nextTutorialStep();
        if (tutorialPrev) tutorialPrev.onclick = () => this.prevTutorialStep();
        if (tutorialSkip) tutorialSkip.onclick = () => this.endTutorial();
        
        const p1Life = document.getElementById('p1-life-badge');
        const p2Life = document.getElementById('p2-life-badge');
        const p1Kl = document.getElementById('p1-kl-badge');
        const p2Kl = document.getElementById('p2-kl-badge');
        
        if (p1Life) {
            p1Life.onclick = () => this.adjustStat(0, 'essence', -1);
            p1Life.oncontextmenu = (e) => { e.preventDefault(); this.adjustStat(0, 'essence', 1); };
        }
        if (p2Life) {
            p2Life.onclick = () => this.adjustStat(1, 'essence', -1);
            p2Life.oncontextmenu = (e) => { e.preventDefault(); this.adjustStat(1, 'essence', 1); };
        }
        if (p1Kl) {
            p1Kl.onclick = () => this.adjustStat(0, 'kl', -1);
            p1Kl.oncontextmenu = (e) => { e.preventDefault(); this.adjustStat(0, 'kl', 1); };
        }
        if (p2Kl) {
            p2Kl.onclick = () => this.adjustStat(1, 'kl', -1);
            p2Kl.oncontextmenu = (e) => { e.preventDefault(); this.adjustStat(1, 'kl', 1); };
        }

        const p1Deck = document.getElementById('p1-deck');
        const p2Deck = document.getElementById('p2-deck');
        const p1Graveyard = document.getElementById('p1-graveyard');
        const p2Graveyard = document.getElementById('p2-graveyard');
        
        if (p1Deck) p1Deck.onclick = () => this.drawCard(0);
        if (p2Deck) p2Deck.onclick = () => this.drawCard(1);
        if (p1Graveyard) p1Graveyard.onclick = () => this.viewPile(0, 'graveyard');
        if (p2Graveyard) p2Graveyard.onclick = () => this.viewPile(1, 'graveyard');

        document.querySelectorAll('#context-menu .context-option').forEach(item => {
            item.onclick = () => this.handleContextAction(item.dataset.action);
        });

        document.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.onclick = () => toggle.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#context-menu')) {
                this.hideContextMenu();
            }
        });
    },

    showDeitySelection(playerIndex) {
        const overlay = document.getElementById('deity-select-overlay');
        const grid = document.getElementById('deity-grid');
        const title = document.getElementById('deity-select-title');
        
        overlay.classList.remove('hidden');
        title.textContent = `SELECT PLAYER ${playerIndex + 1} DEITY`;
        grid.innerHTML = '';

        const deities = getDeities();
        
        deities.forEach(deity => {
            const aspectText = deity.aspects ? deity.aspects.join(' / ') : 'Unknown';
            const option = document.createElement('div');
            option.className = 'deity-option';
            option.innerHTML = `
                <img src="${deity.image}" alt="${deity.name}">
                <div class="deity-name">
                    <h3>${deity.name}</h3>
                    <p>${aspectText} Deity</p>
                    <p class="deity-stats">Essence: ${deity.health} | KL: ${deity.startingKL || 3}</p>
                </div>
                <button class="select-btn">SELECT</button>
            `;
            option.onclick = () => this.selectDeity(deity, playerIndex);
            grid.appendChild(option);
        });
    },

    selectDeity(deity, playerIndex) {
        this.state.selectedDeities[playerIndex] = deity;
        
        if (playerIndex === 0) {
            if (this.state.isAIMatch) {
                AIManager.selectAIDeity();
                document.getElementById('deity-select-overlay').classList.add('hidden');
                this.startGameWithMatchMode();
            } else {
                this.showDeitySelection(1);
            }
        } else {
            document.getElementById('deity-select-overlay').classList.add('hidden');
            this.startGameWithMatchMode();
        }
    },
    
    cancelDeitySelection() {
        document.getElementById('deity-select-overlay').classList.add('hidden');
        this.state.selectedDeities = [];
        this.state.isAIMatch = false;
        this.state.matchMode = null;
        MainMenu.back();
    },
    
    async startGameWithMatchMode() {
        const p1Deity = this.state.selectedDeities[0];
        const p2Deity = this.state.selectedDeities[1];
        const opponentName = this.state.isAIMatch ? 'AI Opponent' : (this.state.challengeFriend || 'Opponent');
        
        await MatchIntro.show(PlayerProfile.data.name, opponentName, p1Deity, p2Deity);
        
        this.startGame();
        if (this.state.isPrivateMatch) {
            this.log(`PRIVATE MATCH vs ${this.state.challengeFriend}`, 'phase');
        } else {
            this.log(`${this.state.matchMode === 'ranked' ? 'RANKED' : 'CASUAL'} Match Started`, 'phase');
        }
    },

    startGame() {
        document.getElementById('game-container').style.display = '';
        document.getElementById('game-controls').style.display = 'flex';
        const matchId = 'match-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
        this.state.matchId = matchId;
        
        if (this.state.matchMode === 'campaign') {
            AudioManager.play('campaign');
        } else {
            AudioManager.play('battle');
        }
        
        MatchRecorder.startRecording(
            matchId,
            this.state.players[0].deity,
            this.state.players[1].deity,
            this.state.matchMode
        );
        
        MatchRecorder.registerLiveMatch(matchId, {
            player1Deity: this.state.players[0].deity?.name || 'Unknown',
            player2Deity: this.state.players[1].deity?.name || 'Unknown',
            matchMode: this.state.matchMode
        });
        
        let mainDeck = ALL_CARDS.filter(c => c.type !== 'Deity');
        
        if (EventManager.activeEvent) {
            mainDeck = mainDeck.filter(c => EventManager.isCardAllowed(c));
            this.log(`Event: ${EventManager.activeEvent.name}`, 'phase');
        }
        
        const useSealedDeck = this.state.matchMode === 'sealed' && this.state.sealedDeck;
        if (useSealedDeck) {
            this.log('SEALED MODE: Using sealed deck', 'phase');
        }
        
        if (this.state.matchMode === 'custom' && this.state.customLobbySettings) {
            const settings = this.state.customLobbySettings;
            mainDeck = mainDeck.filter(c => CustomLobby.isCardAllowed(c, settings));
            this.log(`Custom Rules: ${settings.name}`, 'phase');
        }
        
        for (let p = 0; p < 2; p++) {
            const deity = this.state.selectedDeities[p];
            let startingKL = deity.startingKL || 3;
            let startingEssence = deity.health || 23;
            
            if (EventManager.activeEvent) {
                startingEssence = EventManager.getStartingEssence();
                startingKL = EventManager.getStartingKL();
            }
            
            if (this.state.matchMode === 'custom' && this.state.customLobbySettings) {
                startingEssence = this.state.customLobbySettings.startingEssence;
                startingKL = this.state.customLobbySettings.startingKL;
            }
            
            this.state.players[p].deity = this.createCardInstance(deity);
            this.state.players[p].essence = startingEssence;
            this.state.players[p].klMax = startingKL;
            this.state.players[p].klCurrent = startingKL;
            this.state.players[p].overflow = 0;
            this.state.players[p].godCodeCharges = 1;
            this.state.players[p].godCodeUsed = false;
            
            if (useSealedDeck && p === 0) {
                this.state.players[p].deck = this.state.sealedDeck.map(c => this.createCardInstance(c));
            } else if (this.state.matchMode === 'campaign' && p === 1 && this.state.bossDeck && this.state.bossDeck.length > 0) {
                const bossDeckCards = [];
                for (const cardId of this.state.bossDeck) {
                    const cardTemplate = ALL_CARDS.find(c => c.id === cardId);
                    if (cardTemplate) {
                        bossDeckCards.push(this.createCardInstance(cardTemplate));
                    }
                }
                while (bossDeckCards.length < 30 && mainDeck.length > 0) {
                    const randomCard = mainDeck[Math.floor(Math.random() * mainDeck.length)];
                    bossDeckCards.push(this.createCardInstance(randomCard));
                }
                this.state.players[p].deck = bossDeckCards;
                console.log('Campaign: Loaded boss deck with', bossDeckCards.length, 'cards');
            } else {
                this.state.players[p].deck = mainDeck.map(c => this.createCardInstance(c));
            }
            this.shuffleDeck(p);
            MatchRecorder.recordDeckContents(p, this.state.players[p].deck);
            
            this.log(`${deity.name}: ${startingEssence} Essence, ${startingKL} KL`, 'action');
        }

        this.drawCard(0, 5);
        this.drawCard(1, 5);
        
        // Start battle ambience effects
        BattleEffects.startBattleAmbience();
        
        // Epic match start effect
        BattleEffects.screenFlash('#d4af3755', 300);
        BattleEffects.turnTransition('Player', true);
        
        this.setPhase('dawn');
        this.log('Game started! Shard Wars begin!', 'phase');
        MatchRecorder.recordAction('TURN_START', { turn: 1, player: 0 }, 0);
        this.render();
    },

    createCardInstance(template) {
        return {
            ...template,
            instanceId: ++this.state.cardIdCounter,
            healthCurrent: template.health || 0,
            tapped: false,
            faceDown: false
        };
    },

    setPhase(phase) {
        this.state.currentPhase = phase;
        document.getElementById('phase-name').textContent = this.state.phaseNames[phase];
        document.getElementById('turn-number').textContent = `Turn ${this.state.turnNumber}`;
        this.log(`Phase: ${this.state.phaseNames[phase]}`, 'phase');

        // Cinematic phase transition effect
        if (phase === 'clash') {
            BattleEffects.phaseTransition(this.state.phaseNames[phase]);
        }

        // ===== ENFORCE CORE GAME RULES (ALWAYS) =====
        if (phase === 'dawn') {
            this.handleDawnPhase();
        } else if (phase === 'draw') {
            this.handleDrawPhase();
        }
        
        this.updatePhaseTracker();
        this.highlightLegalPlays();
        
        // === PHASE HINTS: Show contextual tips for player ===
        if (this.state.currentPlayer === 0 && !this.state.isAIMatch) {
            this.showPhaseHint(phase);
        } else if (this.state.currentPlayer === 0) {
            this.showPhaseHint(phase);
        }
        
        TutorialController.onGameEvent('phase_change', { phase: this.state.phaseNames[phase] });
    },
    
    showPhaseHint(phase) {
        const hints = {
            dawn: "Dawn Phase: Your cards untap and start-of-turn effects trigger.",
            draw: "Draw Phase: Drawing a card from your deck...",
            main: "Main Phase: Play Domains, summon Avatars, and cast Spells. Click 'Next Phase' when ready to attack.",
            clash: "Clash Phase: Click your Avatars to attack! Target the enemy Deity or their Avatars.",
            twilight: "Twilight Phase: End-of-turn effects resolve. Hand limit: 7 cards."
        };
        
        const hint = hints[phase];
        if (hint && this.state.currentPlayer === 0) {
            this.showPrompt(hint);
            setTimeout(() => this.hidePrompt(), 4000);
        }
    },
    
    handleDrawPhase() {
        const playerIndex = this.state.currentPlayer;
        const p = this.state.players[playerIndex];
        
        // First player skips draw on turn 1 (first turn starting advantage)
        if (this.state.turnNumber === 1 && playerIndex === 0) {
            this.log('First player skips draw on turn 1', 'phase');
            return;
        }
        
        // === ESSENCE CROWN: Mandatory draw at start of turn ===
        // Draw 1 card from deck (mandatory - deck-out causes loss)
        if (!p.hasDrawnThisTurn) {
            this.drawCard(playerIndex, 1, true); // isMandatory = true
            p.hasDrawnThisTurn = true;
        }
    },
    
    updatePhaseTracker() {
        const tracker = document.getElementById('phase-tracker');
        if (!tracker) return;
        
        const phases = this.state.phases;
        tracker.innerHTML = phases.map(phase => {
            const isCurrent = phase === this.state.currentPhase;
            return `
                <div class="phase-step ${isCurrent ? 'active' : ''}" data-phase="${phase}">
                    <div class="phase-icon">${this.getPhaseIcon(phase)}</div>
                    <div class="phase-label">${this.state.phaseNames[phase].replace(' Phase', '')}</div>
                </div>
            `;
        }).join('');
    },
    
    getPhaseIcon(phase) {
        const icons = {
            dawn: '☀',
            draw: '🃏',
            main: '⚔',
            clash: '💥',
            twilight: '🌙'
        };
        return icons[phase] || '○';
    },

    nextPhase() {
        if (this.state.isReplayMode || this.state.isSpectatorMode) return;
        const phases = this.state.phases;
        const currentIndex = phases.indexOf(this.state.currentPhase);
        const nextIndex = (currentIndex + 1) % phases.length;
        
        if (nextIndex === 0) {
            this.endTurn();
        } else {
            this.setPhase(phases[nextIndex]);
            if (TutorialController.active) {
                TutorialController.onGameEvent('phase_change', { phase: phases[nextIndex] });
            }
        }
    },

    endTurn() {
        if (this.state.isReplayMode || this.state.isSpectatorMode) return;
        MatchRecorder.recordAction('TURN_END', { turn: this.state.turnNumber, player: this.state.currentPlayer }, this.state.currentPlayer);
        this.handleEndTurnPassives(this.state.currentPlayer);
        
        // === ESSENCE CROWN: Enforce hand size limit (default 7) ===
        this.enforceHandSizeLimit(this.state.currentPlayer);
        
        this.state.currentPlayer = 1 - this.state.currentPlayer;
        this.state.turnNumber++;
        this.state.drawsThisTurn = 0;
        this.state.cardsPlayedThisTurn = 0;
        this.state.spellsPlayedThisTurn = 0;
        this.state.players[0].passiveUsedThisTurn = false;
        this.state.players[1].passiveUsedThisTurn = false;
        this.state.players[0].hasDrawnThisTurn = false;
        this.state.players[1].hasDrawnThisTurn = false;
        this.state.combat.attackedThisTurn = [];
        this.state.combat.summonedThisTurn = [];
        this.state.combat.mode = null;
        this.state.combat.selectedAttacker = null;
        this.state.combat.selectedTarget = null;
        // === ESSENCE CROWN: Reset new combat state ===
        this.state.combat.declaredAttackers = [];
        this.state.combat.declaredBlockers = {};
        this.state.combat.tempDamage = {};
        this.state.combat.domainsPlayedThisTurn = 0;
        
        BattleEffects.turnTransition(
            this.state.currentPlayer === 0 ? 'Player' : 'Opponent',
            this.state.currentPlayer === 0
        );
        
        this.setPhase('dawn');
        this.log(`Player ${this.state.currentPlayer + 1}'s turn`, 'phase');
        MatchRecorder.recordAction('TURN_START', { turn: this.state.turnNumber, player: this.state.currentPlayer }, this.state.currentPlayer);
        
        if (TutorialController.active && this.state.currentPlayer === 0) {
            TutorialController.onGameEvent('turn_start', { playerIndex: 0 });
        }
        
        if (this.state.matchMode === 'campaign' && this.state.currentPlayer === 1) {
            CampaignManager.applyBossAbility('turn', { turn: this.state.turnNumber });
            if (Math.random() < 0.25) {
                setTimeout(() => CampaignManager.showBossTaunt(), 500);
            }
        }
        
        if (this.state.currentPlayer === 1) {
            if (this.state.isAIMatch) {
                setTimeout(() => AIManager.takeTurn(), 1000);
            } else {
                setTimeout(() => this.runAI(), 1500);
            }
        }
    },
    
    // ==================== ESSENCE CROWN BATTLE ENGINE HELPERS ====================
    // These functions implement the core TCG battle rules per the Essence Crown ruleset
    
    /**
     * Enforce hand size limit at end of turn (default 7 cards)
     * If player has more than limit, discard down to limit
     */
    enforceHandSizeLimit(playerIndex, limit = 7) {
        const player = this.state.players[playerIndex];
        if (player.hand.length > limit) {
            const discardCount = player.hand.length - limit;
            // AI auto-discards lowest value cards, player would get a prompt
            if (playerIndex === 1) {
                // AI: discard highest cost cards first (usually least useful when full hand)
                player.hand.sort((a, b) => (b.cost || 0) - (a.cost || 0));
                for (let i = 0; i < discardCount; i++) {
                    const discarded = player.hand.shift();
                    player.graveyard.push(discarded);
                    this.log(`Opponent discarded ${discarded.name} (hand limit)`, 'action');
                }
            } else {
                // TODO: Player gets to choose what to discard via UI
                // For now, auto-discard oldest cards
                for (let i = 0; i < discardCount; i++) {
                    const discarded = player.hand.pop();
                    player.graveyard.push(discarded);
                    this.log(`Discarded ${discarded.name} (hand limit: ${limit})`, 'action');
                }
            }
            this.render();
        }
    },
    
    /**
     * Check if a Domain can be played this turn
     * Returns true if player hasn't hit domain limit
     */
    canPlayDomain(playerIndex) {
        const domainsPlayed = this.state.combat.domainsPlayedThisTurn;
        const limit = this.state.combat.maxDomainsPerTurn;
        return domainsPlayed < limit;
    },
    
    /**
     * Track domain play for the turn
     * Called when a Domain card is successfully played
     */
    recordDomainPlay() {
        this.state.combat.domainsPlayedThisTurn++;
    },
    
    /**
     * Check if an Avatar has summoning sickness
     * Returns true if the avatar was summoned this turn
     */
    hasSummoningSickness(card) {
        // Cards with Haste/Swift can attack immediately
        if (hasHaste(card)) {
            return false;
        }
        return this.state.combat.summonedThisTurn.includes(card.instanceId);
    },
    
    /**
     * Get all valid attackers for the current player
     * Returns avatars that are untapped, not summoned this turn, and haven't attacked
     */
    getValidAttackers(playerIndex) {
        const player = this.state.players[playerIndex];
        return player.avatarRow.filter(card => 
            !card.tapped &&
            !this.state.combat.attackedThisTurn.includes(card.instanceId) &&
            !this.hasSummoningSickness(card)
        );
    },
    
    /**
     * Get all valid blockers for defending player
     * Returns untapped avatars that can block
     */
    getValidBlockers(playerIndex) {
        const player = this.state.players[playerIndex];
        return player.avatarRow.filter(card => 
            !card.tapped &&
            !card.cantBlock // Support for "cannot block" effects
        );
    },
    
    /**
     * Calculate combat damage using Power vs Guard (attack vs health)
     * Attacker deals its Power to defender's Guard
     * Returns the damage that would be dealt
     */
    calculateCombatDamage(attacker, defender) {
        const attackerPower = attacker.attack || 0;
        const defenderPower = defender.attack || 0;
        return {
            damageToDefender: attackerPower,
            damageToAttacker: defenderPower
        };
    },
    
    /**
     * Apply temporary damage to a card during combat
     * Damage accumulates until combat resolution completes
     */
    applyTempDamage(card, damage) {
        if (!this.state.combat.tempDamage[card.instanceId]) {
            this.state.combat.tempDamage[card.instanceId] = 0;
        }
        this.state.combat.tempDamage[card.instanceId] += damage;
    },
    
    /**
     * Get current health of a card (accounting for temp damage)
     */
    getEffectiveHealth(card) {
        const baseHealth = card.healthCurrent !== undefined ? card.healthCurrent : (card.health || 0);
        const tempDamage = this.state.combat.tempDamage[card.instanceId] || 0;
        return baseHealth - tempDamage;
    },
    
    /**
     * Check if a card should be destroyed (temp damage >= health)
     */
    shouldBeDestroyed(card) {
        return this.getEffectiveHealth(card) <= 0;
    },
    
    /**
     * Finalize combat damage - apply temp damage permanently and destroy dead cards
     */
    finalizeCombatDamage() {
        const toDestroy = [];
        
        // Apply temp damage to all cards
        for (const [instanceId, damage] of Object.entries(this.state.combat.tempDamage)) {
            // Find the card across all players
            for (let p = 0; p < 2; p++) {
                const player = this.state.players[p];
                const card = player.avatarRow.find(c => c.instanceId === parseInt(instanceId));
                if (card) {
                    card.healthCurrent = (card.healthCurrent !== undefined ? card.healthCurrent : card.health) - damage;
                    if (card.healthCurrent <= 0) {
                        toDestroy.push({ card, playerIndex: p });
                    }
                }
            }
        }
        
        // Destroy dead cards
        for (const { card, playerIndex } of toDestroy) {
            this.destroyCard(card, playerIndex);
        }
        
        // Clear temp damage
        this.state.combat.tempDamage = {};
    },
    
    /**
     * Destroy a card and move it to graveyard
     */
    destroyCard(card, playerIndex) {
        const player = this.state.players[playerIndex];
        const index = player.avatarRow.findIndex(c => c.instanceId === card.instanceId);
        if (index !== -1) {
            player.avatarRow.splice(index, 1);
            player.graveyard.push(card);
            this.log(`${card.name} was destroyed!`, 'damage');
            this.handleOnDeathTrigger(card, playerIndex);
            
            // Visual effect
            const cardEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
            if (cardEl) {
                cardEl.classList.add('ec-destroy-anim');
            }
        }
    },
    
    /**
     * Deal damage directly to player's Essence
     */
    dealDamageToEssence(playerIndex, damage) {
        this.adjustStat(playerIndex, 'essence', -damage);
        this.log(`Player ${playerIndex + 1} takes ${damage} Essence damage!`, 'damage');
        this.spawnDamageNumber(playerIndex === 0 ? 'p1-deity' : 'p2-deity', damage);
        this.screenShake(damage >= 3 ? 'heavy' : 'light');
        this.checkWinCondition();
    },
    
    // ==================== STRATEGIC AI SYSTEM ====================
    
    // Evaluate board state advantage (-100 to +100, positive = AI winning)
    aiEvaluateBoard() {
        const ai = this.state.players[1];
        const player = this.state.players[0];
        let score = 0;
        
        // Essence advantage (most important)
        score += (ai.essence - player.essence) * 3;
        
        // Board presence
        const aiBoardPower = ai.avatarRow.reduce((sum, c) => sum + (c.attack || 0) + (c.currentHealth || c.health || 0), 0);
        const playerBoardPower = player.avatarRow.reduce((sum, c) => sum + (c.attack || 0) + (c.currentHealth || c.health || 0), 0);
        score += (aiBoardPower - playerBoardPower) * 1.5;
        
        // Card advantage
        score += (ai.hand.length - player.hand.length) * 2;
        
        // KL advantage
        score += (ai.klCurrent - player.klCurrent) * 0.5;
        
        // Domain bonuses
        score += ai.domainRow.filter(c => c.type === 'Domain').length * 3;
        score -= player.domainRow.filter(c => c.type === 'Domain').length * 3;
        
        return Math.max(-100, Math.min(100, score));
    },
    
    // Get dominant aspect on AI's board
    aiGetDominantAspect() {
        const ai = this.state.players[1];
        const aspects = { Glow: 0, Void: 0, Gray: 0 };
        
        [...ai.avatarRow, ...ai.domainRow].forEach(card => {
            if (card.aspects) {
                card.aspects.forEach(a => {
                    if (aspects[a] !== undefined) aspects[a]++;
                });
            } else if (card.aspect) {
                if (aspects[card.aspect] !== undefined) aspects[card.aspect]++;
            }
        });
        
        // Include deity aspect preference
        if (ai.deity) {
            if (ai.deity.name.includes('Solara') || ai.deity.name.includes('Radiance')) aspects.Glow += 2;
            if (ai.deity.name.includes('Nyx') || ai.deity.name.includes('Void')) aspects.Void += 2;
            if (ai.deity.name.includes('Arbiter') || ai.deity.name.includes('Chronicler')) aspects.Gray += 2;
        }
        
        const max = Math.max(aspects.Glow, aspects.Void, aspects.Gray);
        if (max === 0) return null;
        return Object.keys(aspects).find(k => aspects[k] === max);
    },
    
    // Score a card for playing based on strategic value
    aiScoreCard(card) {
        const ai = this.state.players[1];
        const player = this.state.players[0];
        let score = 0;
        
        // Base value from stats
        if (card.type === 'Avatar') {
            score += (card.attack || 0) * 2;
            score += (card.health || 0) * 1.5;
            
            // Guardian is valuable when we need defense
            if (hasGuardian(card)) {
                score += ai.essence < 10 ? 15 : 5;
            }
            
            // Beast synergy
            if (card.effect && card.effect.toLowerCase().includes('beast')) {
                const beastCount = ai.avatarRow.filter(c => c.effect && c.effect.toLowerCase().includes('beast')).length;
                score += beastCount * 3;
            }
        }
        
        // Spell effectiveness
        if (card.type === 'Spell') {
            // Damage spells more valuable when opponent has threats
            if (card.effect && (card.effect.includes('damage') || card.effect.includes('destroy'))) {
                score += player.avatarRow.length * 5;
            }
            // Healing spells more valuable at low Essence
            if (card.effect && (card.effect.includes('Essence') || card.effect.includes('heal'))) {
                score += ai.essence < 10 ? 15 : 3;
            }
            // Draw spells always good
            if (card.effect && card.effect.includes('draw')) {
                score += 8;
            }
        }
        
        // Domain cards provide ongoing value
        if (card.type === 'Domain') {
            score += 12;
            // More valuable early game
            if (this.state.turnNumber < 5) score += 5;
        }
        
        // Aspect synergy bonus
        const dominantAspect = this.aiGetDominantAspect();
        if (dominantAspect) {
            const cardAspects = card.aspects || (card.aspect ? [card.aspect] : []);
            if (cardAspects.includes(dominantAspect)) {
                score += 8; // Strong synergy bonus
            }
        }
        
        // Curve consideration - prefer efficient plays
        const efficiency = (card.attack || 0) + (card.health || 0) - card.cost;
        score += efficiency * 0.5;
        
        // Threat response - boost removal when facing big threats
        const bigThreats = player.avatarRow.filter(c => (c.attack || 0) >= 4);
        if (bigThreats.length > 0 && card.effect && card.effect.toLowerCase().includes('destroy')) {
            score += 10;
        }
        
        return score;
    },
    
    // Determine optimal attack target for an attacker
    aiSelectBestTarget(attacker) {
        const player = this.state.players[0];
        const guardians = this.getGuardians(0);
        
        // LETHAL CHECK: If we can kill opponent this turn, go face immediately!
        if (guardians.length === 0 && attacker.attack >= player.essence) {
            return { type: 'deity', playerIndex: 0 };
        }
        
        // Must attack guardians first
        if (guardians.length > 0) {
            // Pick the guardian we can kill or trade best with
            return guardians.sort((a, b) => {
                const aCanKill = attacker.attack >= (a.currentHealth || a.health);
                const bCanKill = attacker.attack >= (b.currentHealth || b.health);
                if (aCanKill && !bCanKill) return -1;
                if (!aCanKill && bCanKill) return 1;
                // Prefer lower health targets
                return (a.currentHealth || a.health) - (b.currentHealth || b.health);
            })[0];
        }
        
        // No guardians - evaluate all targets
        if (player.avatarRow.length === 0) {
            // Go face!
            return { type: 'deity', playerIndex: 0 };
        }
        
        // Score each potential target
        const scoredTargets = player.avatarRow.map(target => {
            let score = 0;
            const targetHealth = target.currentHealth || target.health;
            const canKill = attacker.attack >= targetHealth;
            const willDie = target.attack >= (attacker.currentHealth || attacker.health);
            
            // Prefer killing without dying
            if (canKill && !willDie) score += 30;
            // Good trades (we kill, they kill)
            else if (canKill && willDie) {
                // Compare card values
                const attackerValue = (attacker.attack || 0) + (attacker.health || 0);
                const targetValue = (target.attack || 0) + (target.health || 0);
                if (targetValue >= attackerValue) score += 15; // Good trade
            }
            // We can kill their big threat
            else if (canKill) score += 20;
            
            // Prioritize high-attack threats
            score += (target.attack || 0) * 2;
            
            // Bonus for removing cards with dangerous effects
            if (target.effect && (target.effect.includes('damage') || target.effect.includes('destroy'))) {
                score += 10;
            }
            
            return { target, score };
        });
        
        // Consider going face - higher priority when opponent is low on Essence
        const faceScore = player.essence <= attacker.attack ? 100 :  // Lethal!
                         player.essence <= 5 ? 35 :                    // Very low
                         player.essence <= 10 ? 20 : 5;                // Normal
        scoredTargets.push({ target: { type: 'deity', playerIndex: 0 }, score: faceScore });
        
        // Return best target
        scoredTargets.sort((a, b) => b.score - a.score);
        return scoredTargets[0].target;
    },
    
    // Main AI turn logic with strategic decision-making
    runAI() {
        const ai = this.state.players[1];
        const boardAdvantage = this.aiEvaluateBoard();
        
        this.log('Opponent is strategizing...', 'phase');
        
        // Determine play style based on board state
        const playStyle = boardAdvantage > 20 ? 'aggressive' : 
                         boardAdvantage < -20 ? 'defensive' : 'balanced';
        
        setTimeout(() => {
            // Play multiple cards if possible (up to 3 per turn for realism)
            let cardsPlayed = 0;
            const maxCardsPerTurn = 3;
            
            const playNextCard = () => {
                if (cardsPlayed >= maxCardsPerTurn || ai.klCurrent <= 0) {
                    // Move to combat phase
                    this.aiContinueToCombat();
                    return;
                }
                
                const playableCards = ai.hand.filter(c => c.cost <= ai.klCurrent);
                if (playableCards.length === 0) {
                    this.aiContinueToCombat();
                    return;
                }
                
                // Score all playable cards
                const scoredCards = playableCards.map(card => ({
                    card,
                    score: this.aiScoreCard(card)
                }));
                
                // Adjust scores based on play style
                if (playStyle === 'aggressive') {
                    scoredCards.forEach(sc => {
                        if (sc.card.type === 'Avatar' && (sc.card.attack || 0) >= 3) sc.score += 5;
                    });
                } else if (playStyle === 'defensive') {
                    scoredCards.forEach(sc => {
                        if (hasGuardian(sc.card)) sc.score += 10;
                        if (sc.card.effect && sc.card.effect.includes('heal')) sc.score += 5;
                    });
                }
                
                // Sort by score and play best card
                scoredCards.sort((a, b) => b.score - a.score);
                
                if (scoredCards.length > 0 && scoredCards[0].score > 0) {
                    this.aiPlayCard(scoredCards[0].card);
                    cardsPlayed++;
                    
                    // Delay between card plays for visual effect
                    setTimeout(playNextCard, 800);
                } else {
                    this.aiContinueToCombat();
                }
            };
            
            playNextCard();
        }, 800);
    },
    
    aiContinueToCombat() {
        setTimeout(() => {
            this.setPhase('clash');
            
            setTimeout(() => {
                this.aiStrategicAttack();
                
                setTimeout(() => {
                    this.log('Opponent ends turn', 'phase');
                    this.endTurn();
                }, 1000);
            }, 1000);
        }, 600);
    },
    
    // Strategic attack with all available attackers
    aiStrategicAttack() {
        const ai = this.state.players[1];
        
        const availableAttackers = ai.avatarRow.filter(c => 
            !this.state.combat.attackedThisTurn.includes(c.instanceId) &&
            !this.state.combat.summonedThisTurn.includes(c.instanceId) &&
            !c.tapped &&
            (c.attack || 0) > 0
        );
        
        if (availableAttackers.length === 0) return;
        
        // Sort attackers by attack power (strongest first for maximum pressure)
        availableAttackers.sort((a, b) => (b.attack || 0) - (a.attack || 0));
        
        // Execute attacks sequentially
        const executeAttack = (index) => {
            if (index >= availableAttackers.length) return;
            
            const attacker = availableAttackers[index];
            
            // Re-check if attacker is still valid (may have been destroyed)
            if (!ai.avatarRow.includes(attacker)) {
                executeAttack(index + 1);
                return;
            }
            
            const target = this.aiSelectBestTarget(attacker);
            
            this.log(`${attacker.name} attacks ${target.type === 'deity' ? 'the enemy Deity' : target.name}!`, 'damage');
            MatchRecorder.recordAction('ATTACK', { attackerId: attacker.id, attackerName: attacker.name, targetId: target.id || 'deity', targetName: target.name || 'Deity' }, this.state.currentPlayer);
            
            if (target.type === 'deity') {
                this.dealDamageToDeity(0, attacker.attack);
            } else {
                this.dealDamageToCard(target, attacker.attack, 0);
                this.dealDamageToCard(attacker, target.attack || 0, 1);
            }
            
            this.state.combat.attackedThisTurn.push(attacker.instanceId);
            attacker.tapped = true;
            
            this.checkWinCondition();
            this.render();
            
            // Small delay between attacks
            if (index < availableAttackers.length - 1) {
                setTimeout(() => executeAttack(index + 1), 500);
            }
        };
        
        executeAttack(0);
    },
    
    aiPlayCard(card) {
        const ai = this.state.players[1];
        const handIndex = ai.hand.findIndex(c => c.instanceId === card.instanceId);
        
        if (handIndex === -1) return;
        
        ai.hand.splice(handIndex, 1);
        ai.klCurrent -= card.cost;
        
        if (card.type === 'Avatar') {
            ai.avatarRow.push(card);
            this.state.combat.summonedThisTurn.push(card.instanceId);
            this.log(`Opponent summoned ${card.name}!`, 'action');
            this.handleOnEnterTrigger(card, 1);
            this.handleAvatarEnterPassive(card, 1);
            this.animateAICardPlay(card);
        } else if (card.type === 'Spell') {
            ai.graveyard.push(card);
            this.log(`Opponent cast ${card.name}!`, 'action');
            this.handleSpellEffect(card, 1);
            this.handleDeitySpellPassive(1);
            this.animateAICardPlay(card);
        } else if (card.type === 'Domain') {
            ai.domainRow.push(card);
            this.log(`Opponent played Domain: ${card.name}!`, 'action');
            this.handleOnEnterTrigger(card, 1);
            this.animateAICardPlay(card);
        } else if (card.type === 'Relic' || card.type === 'Crown') {
            ai.domainRow.push(card);
            this.log(`Opponent equipped ${card.name}!`, 'action');
            this.handleOnEnterTrigger(card, 1);
            this.animateAICardPlay(card);
        }
        
        this.handleAspectTrigger(card, 1);
        this.state.cardsPlayedThisTurn++;
        this.render();
    },
    
    animateAICardPlay(card) {
        const overlay = document.getElementById('ai-play-overlay');
        if (!overlay) return;
        
        overlay.innerHTML = `
            <div class="ai-play-container">
                <div class="ai-play-text">OPPONENT PLAYS</div>
                <div class="ai-play-card ${card.aspects && card.aspects[0] ? card.aspects[0].toLowerCase() : ''}">
                    <img src="${card.image}" alt="${card.name}">
                    <div class="ai-play-info">
                        <div class="ai-play-name">${card.name}</div>
                        ${card.attack !== undefined ? `<div class="ai-play-stats">${card.attack} / ${card.health}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        overlay.classList.add('visible');
        
        setTimeout(() => {
            overlay.classList.remove('visible');
        }, 1500);
    },
    
    handleEndTurnPassives(playerIndex) {
        if (!this.state.rulesHelper) return;
        const p = this.state.players[playerIndex];
        const deity = p.deity;
        if (!deity || !deity.passive) return;
        
        if (deity.passive === 'Perfect Balance') {
            const opponent = this.state.players[1 - playerIndex];
            if (p.essence === opponent.essence) {
                this.drawCardEffect(playerIndex, 1);
                this.log(`${deity.passive}: Both Deities have equal Essence, drew 1 card`, 'action');
            }
        }
        
        if (deity.passive === 'Quiet Orbit') {
            if (!this.state.combat.attackedThisTurn.some(id => 
                p.avatarRow.some(c => c.instanceId === id) || p.domainRow.some(c => c.instanceId === id)
            )) {
                this.adjustStat(playerIndex, 'essence', 2);
                this.log(`${deity.passive}: No attacks this turn, restored 2 Essence`, 'heal');
            }
        }
    },

    handleDawnPhase() {
        const playerIndex = this.state.currentPlayer;
        const p = this.state.players[playerIndex];
        
        // Restore KL (max increases by 1 each turn, up to 13)
        if (p.klMax < 13) {
            p.klMax++;
        }
        p.klCurrent = p.klMax;
        
        // Reset turn counters
        this.state.drawsThisTurn = 0;
        
        // Untap all permanents (Avatars and Domains)
        p.avatarRow.forEach(c => c.tapped = false);
        p.domainRow.forEach(c => c.tapped = false);
        
        // Check deity dawn passives
        this.handleDawnPassives(playerIndex);
        
        this.log(`${p.deity.name}: KL restored to ${p.klMax}`, 'action');
        this.render();
    },
    
    handleDawnPassives(playerIndex) {
        if (!this.state.rulesHelper) return;
        const p = this.state.players[playerIndex];
        const deity = p.deity;
        if (!deity || !deity.passive) return;
        
        if (deity.passive === 'Solar Flow') {
            const hasGlowAvatar = p.avatarRow.some(c => c.aspects && c.aspects.includes('Glow')) ||
                                  p.domainRow.some(c => c.aspects && c.aspects.includes('Glow'));
            if (hasGlowAvatar) {
                this.adjustStat(playerIndex, 'kl', 1);
                this.log(`${deity.passive}: +1 KL (controlling Glow Avatar)`, 'action');
            }
        }
        
        if (deity.passive === 'Familiar Swarm') {
        }
    },

    drawCardManual() {
        if (this.state.isReplayMode || this.state.isSpectatorMode) return;
        if (this.state.currentPlayer !== 0) {
            this.showPrompt('It\'s not your turn!');
            return;
        }
        if (this.state.currentPhase !== 'draw') {
            this.showPrompt('You can only draw during the Draw phase!');
            return;
        }
        if (this.state.drawsThisTurn >= 1) {
            this.showPrompt('You already drew a card this turn!');
            return;
        }
        
        this.playDrawAnimation(() => {
            this.drawCard(0, 1);
        });
    },
    
    playDrawAnimation(callback) {
        const deckPile = document.getElementById('deck-pile');
        const handContainer = document.getElementById('player-hand');
        if (!deckPile || !handContainer) {
            if (callback) callback();
            return;
        }
        
        const deckRect = deckPile.getBoundingClientRect();
        const handRect = handContainer.getBoundingClientRect();
        
        const animCard = document.createElement('div');
        animCard.className = 'ec-draw-animation';
        animCard.style.left = (deckRect.left + deckRect.width/2 - 40) + 'px';
        animCard.style.top = (deckRect.top + deckRect.height/2 - 55) + 'px';
        
        const targetX = handRect.left + handRect.width/2 - 40;
        const targetY = handRect.top;
        
        animCard.style.setProperty('--target-x', `${targetX - deckRect.left - deckRect.width/2 + 40}px`);
        animCard.style.setProperty('--target-y', `${targetY - deckRect.top - deckRect.height/2 + 55}px`);
        
        document.body.appendChild(animCard);
        
        animCard.animate([
            { 
                transform: 'scale(1) rotate(0deg)',
                opacity: 1
            },
            { 
                transform: `scale(1.2) rotate(10deg) translate(${(targetX - deckRect.left)/2}px, ${(targetY - deckRect.top)/2}px)`,
                opacity: 1
            },
            { 
                transform: `scale(0.9) rotate(0deg) translate(${targetX - deckRect.left}px, ${targetY - deckRect.top}px)`,
                opacity: 0.5
            }
        ], {
            duration: 400,
            easing: 'ease-out'
        }).onfinish = () => {
            animCard.remove();
            if (callback) callback();
        };
    },

    drawCard(playerIndex, count = 1, isMandatory = false) {
        if (this.state.isReplayMode || this.state.isSpectatorMode) return;
        const p = this.state.players[playerIndex];
        
        if (this.state.rulesHelper && playerIndex === this.state.currentPlayer) {
            if (this.state.drawsThisTurn + count > 1) {
                this.log(`Can only draw 1 card per turn (unless card effects allow it)`, 'damage');
                return;
            }
        }
        
        for (let i = 0; i < count; i++) {
            if (p.deck.length > 0) {
                const card = p.deck.pop();
                p.hand.push(card);
                this.state.drawsThisTurn++;
                this.log(`Player ${playerIndex + 1} drew ${card.name}`, 'action');
                MatchRecorder.recordAction('DRAW', { cardId: card.id, cardName: card.name }, playerIndex);
                this.animateCardDraw(card, playerIndex);
                this.emitEvent('ON_CARD_DRAWN', { card, playerIndex });
            } else {
                // === ESSENCE CROWN: Deck-out loss condition ===
                // If player must draw but deck is empty, they lose the game
                if (isMandatory) {
                    this.log(`${playerIndex === 0 ? 'You' : 'Opponent'} cannot draw - deck is empty!`, 'damage');
                    this.log(`DECK OUT! ${playerIndex === 0 ? 'You lose' : 'Opponent loses'}!`, 'phase');
                    BattleEffects.screenFlash('#ff000055', 500);
                    this.triggerGameEnd(1 - playerIndex, 'deck_out');
                    return;
                } else {
                    this.log(`${playerIndex === 0 ? 'Your' : 'Opponent\'s'} deck is empty!`, 'damage');
                }
            }
        }
        this.render();
    },
    
    animateCardDraw(card, playerIndex) {
        const overlay = document.getElementById('draw-animation');
        if (!overlay) return;
        
        overlay.innerHTML = `
            <div class="draw-card-container">
                <div class="draw-card ${card.aspects && card.aspects[0] ? card.aspects[0].toLowerCase() : ''}">
                    <img src="${card.image}" alt="${card.name}">
                    <div class="draw-card-info">
                        <div class="draw-card-name">${card.name}</div>
                        <div class="draw-card-cost">${card.cost} KL</div>
                        ${card.attack !== undefined ? `<div class="draw-card-stats">${card.attack} / ${card.health}</div>` : ''}
                    </div>
                </div>
                <div class="draw-text">DRAW!</div>
            </div>
        `;
        
        overlay.classList.add('visible');
        
        setTimeout(() => {
            overlay.classList.remove('visible');
        }, 1200);
    },

    shuffleDeck(playerIndex) {
        const deck = this.state.players[playerIndex].deck;
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        this.log(`Player ${playerIndex + 1} shuffled deck`, 'action');
    },

    adjustStat(playerIndex, stat, delta) {
        const p = this.state.players[playerIndex];
        
        if (stat === 'essence') {
            const oldEssence = p.essence;
            p.essence = Math.max(0, p.essence + delta);
            if (delta < 0) {
                this.emitEvent('ON_ESSENCE_LOSS', { playerIndex, amount: -delta, newTotal: p.essence });
            } else if (delta > 0) {
                this.emitEvent('ON_ESSENCE_GAIN', { playerIndex, amount: delta, newTotal: p.essence });
            }
            if (p.essence === 0) {
                this.log(`Player ${playerIndex + 1} has been defeated!`, 'damage');
                this.checkWinCondition();
            }
        } else if (stat === 'kl') {
            const newKL = p.klCurrent + delta;
            if (newKL > p.klMax) {
                const excess = newKL - p.klMax;
                p.klCurrent = p.klMax;
                this.adjustStat(playerIndex, 'overflow', excess);
            } else {
                p.klCurrent = Math.max(0, newKL);
            }
        } else if (stat === 'klMax') {
            const newMax = p.klMax + delta;
            if (newMax > 13) {
                const excess = newMax - 13;
                p.klMax = 13;
                this.adjustStat(playerIndex, 'overflow', excess);
            } else {
                p.klMax = Math.max(1, newMax);
            }
        } else if (stat === 'overflow') {
            p.overflow = Math.max(0, p.overflow + delta);
            if (p.overflow >= 13 && this.state.rulesHelper && p.godCodeCharges < 2) {
                p.overflow -= 13;
                p.godCodeCharges = Math.min(2, p.godCodeCharges + 1);
                this.log('Essence Crown charged! +1 God Code charge!', 'heal');
                this.spawnParticles({ type: 'effect' }, 'gold');
            }
        }
        
        this.render();
    },

    playCard(card, playerIndex, zone = 'front') {
        if (this.state.isReplayMode || this.state.isSpectatorMode) return;
        const p = this.state.players[playerIndex];
        const handIndex = p.hand.findIndex(c => c.instanceId === card.instanceId);
        
        if (handIndex === -1) return;
        
        if (this.state.rulesHelper && card.cost > p.klCurrent) {
            this.log(`Not enough KL! Need ${card.cost}, have ${p.klCurrent}`, 'damage');
            return;
        }
        
        const klBeforePlay = p.klCurrent;
        p.hand.splice(handIndex, 1);
        p.klCurrent -= card.cost;
        
        this.state.cardsPlayedThisTurn++;
        
        if (card.type === 'Avatar') {
            p.avatarRow.push(card);
            this.state.combat.summonedThisTurn.push(card.instanceId);
            this.log(`Player ${playerIndex + 1} summoned ${card.name}`, 'action');
            MatchRecorder.recordCardPlayed(card, playerIndex);
            MatchRecorder.recordAction('CARD_PLAYED', { cardId: card.id, cardName: card.name, type: card.type, zone: 'avatarRow' }, playerIndex);
            this.emitEvent('ON_AVATAR_SUMMONED', { card, playerIndex, zone: 'avatarRow' });
            this.handleOnEnterTrigger(card, playerIndex);
            this.handleAvatarEnterPassive(card, playerIndex);
            if (this.state.matchMode === 'campaign' && playerIndex === 1) {
                CampaignManager.applyBossAbility('summon', { card, playerIndex });
            }
        } else if (card.type === 'Domain') {
            // === ESSENCE CROWN: Enforce 1 Domain per turn limit ===
            if (this.state.rulesHelper && !this.canPlayDomain(playerIndex)) {
                this.log(`Cannot play another Domain this turn! (Limit: ${this.state.combat.maxDomainsPerTurn})`, 'damage');
                p.hand.push(card);
                p.klCurrent += card.cost;
                this.state.cardsPlayedThisTurn--;
                return;
            }
            if (p.domain) p.graveyard.push(p.domain);
            p.domain = card;
            p.domainRow.push(card);
            this.recordDomainPlay();
            this.log(`Player ${playerIndex + 1} set Domain: ${card.name}`, 'action');
            MatchRecorder.recordCardPlayed(card, playerIndex);
            MatchRecorder.recordAction('CARD_PLAYED', { cardId: card.id, cardName: card.name, type: card.type, zone: 'domainRow' }, playerIndex);
            this.handleOnEnterTrigger(card, playerIndex);
        } else if (card.type === 'Spell') {
            const targetType = this.getSpellTargetType(card);
            if (targetType && !this.state.spell.mode) {
                this.state.spell.mode = 'selectTarget';
                this.state.spell.pendingSpell = card;
                this.state.spell.targetType = targetType;
                p.klCurrent += card.cost;
                p.hand.push(card);
                this.state.cardsPlayedThisTurn--;
                this.showPrompt(`Select a target for ${card.name}`);
                this.render();
                return;
            }
            p.graveyard.push(card);
            this.state.spellsPlayedThisTurn++;
            this.log(`Player ${playerIndex + 1} cast ${card.name}!`, 'action');
            MatchRecorder.recordCardPlayed(card, playerIndex);
            MatchRecorder.recordAction('CARD_PLAYED', { cardId: card.id, cardName: card.name, type: card.type, zone: 'graveyard' }, playerIndex);
            this.handleSpellEffect(card, playerIndex);
            this.handleDeitySpellPassive(playerIndex);
        }
        
        if (this.state.cardsPlayedThisTurn === 2) {
            this.handleSecondCardPassive(playerIndex);
        }
        
        if (p.klCurrent === 0 && klBeforePlay === card.cost) {
            this.handleExactKLSpendPassive(playerIndex);
        }
        
        this.handleAspectTrigger(card, playerIndex);
        this.animateCardPlay(card);
        this.render();
        
        if (TutorialController.active && playerIndex === 0) {
            TutorialController.onGameEvent('card_played', { card, playerIndex });
        }
    },
    
    handleOnEnterTrigger(card, playerIndex) {
        if (!this.state.rulesHelper) return;
        if (!card.effect) return;
        
        const effect = card.effect.toLowerCase();
        
        if (effect.includes('on play:') || effect.includes('on enter:') || effect.includes('when') && effect.includes('enters')) {
            if (effect.includes('restore') && effect.includes('essence')) {
                const match = effect.match(/restore (\d+) essence/i);
                if (match) {
                    const amount = parseInt(match[1]);
                    this.adjustStat(playerIndex, 'essence', amount);
                    this.log(`${card.name}: Restored ${amount} Essence`, 'heal');
                }
            }
            
            if (effect.includes('deal') && effect.includes('damage') && effect.includes('deity')) {
                const match = effect.match(/deal (\d+)/i);
                if (match) {
                    const damage = parseInt(match[1]);
                    this.adjustStat(1 - playerIndex, 'essence', -damage);
                    this.log(`${card.name}: Dealt ${damage} damage to opponent`, 'damage');
                }
            }
            
            if (effect.includes('opponent loses') && effect.includes('essence')) {
                const match = effect.match(/loses (\d+) essence/i);
                if (match) {
                    const amount = parseInt(match[1]);
                    this.adjustStat(1 - playerIndex, 'essence', -amount);
                    this.log(`${card.name}: Opponent lost ${amount} Essence`, 'damage');
                }
            }
            
            if (effect.includes('draw a card') || effect.includes('draw 1')) {
                this.drawCardEffect(playerIndex, 1);
                this.log(`${card.name}: Drew 1 card`, 'action');
            }
            
            if (effect.includes('+1 kl') || effect.includes('gain') && effect.includes('kl')) {
                this.adjustStat(playerIndex, 'kl', 1);
                this.log(`${card.name}: Gained +1 KL`, 'action');
            }
        }
    },
    
    handleDeitySpellPassive(playerIndex) {
        if (!this.state.rulesHelper) return;
        const p = this.state.players[playerIndex];
        const deity = p.deity;
        if (!deity || !deity.passive) return;
        
        if (deity.passive === 'Presence of Wealth' && !p.passiveUsedThisTurn) {
            p.passiveUsedThisTurn = true;
            this.adjustStat(playerIndex, 'essence', 1);
            this.log(`${deity.passive}: +1 Essence from playing a Spell`, 'heal');
        }
    },
    
    handleSecondCardPassive(playerIndex) {
        if (!this.state.rulesHelper) return;
        const p = this.state.players[playerIndex];
        const deity = p.deity;
        if (!deity || !deity.passive) return;
        
        if (deity.passive === 'Story of the Shards' && !p.passiveUsedThisTurn) {
            p.passiveUsedThisTurn = true;
            this.drawCardEffect(playerIndex, 1);
            this.log(`${deity.passive}: Drew 1 card`, 'action');
        }
        
        if (deity.passive === 'Shard War Architect' && !p.passiveUsedThisTurn) {
            p.passiveUsedThisTurn = true;
            this.adjustStat(1 - playerIndex, 'essence', -1);
            this.drawCardEffect(playerIndex, 1);
            this.log(`${deity.passive}: Opponent lost 1 Essence, drew 1 card`, 'action');
        }
    },
    
    handleExactKLSpendPassive(playerIndex) {
        if (!this.state.rulesHelper) return;
        const p = this.state.players[playerIndex];
        const deity = p.deity;
        if (!deity || !deity.passive) return;
        
        if (deity.passive === 'Calibrated Flow') {
            this.drawCardEffect(playerIndex, 1);
            this.log(`${deity.passive}: Drew 1 card (spent exact KL)`, 'action');
        }
    },
    
    handleAvatarEnterPassive(card, playerIndex) {
        if (!this.state.rulesHelper) return;
        const p = this.state.players[playerIndex];
        const deity = p.deity;
        if (!deity || !deity.passive) return;
        
        if (deity.passive === 'Packbond' && isBeast(card)) {
            this.adjustStat(playerIndex, 'essence', 1);
            this.log(`${deity.passive}: Beast entered - restored 1 Essence!`, 'heal');
        }
        
        if (deity.passive === 'Familiar Swarm' && !p.passiveUsedThisTurn) {
            if (isBeast(card) || card.cost <= 2) {
                p.passiveUsedThisTurn = true;
                this.adjustStat(1 - playerIndex, 'essence', -1);
                this.adjustStat(playerIndex, 'kl', 1);
                this.log(`${deity.passive}: Beast/low-cost entered - opponent lost 1 Essence, +1 KL!`, 'action');
            }
        }
        
        if (deity.passive === 'Solar Flow' && !p.passiveUsedThisTurn) {
            const hasGlowAvatar = p.avatarRow.some(c => c.aspects && c.aspects.includes('Glow'));
            if (hasGlowAvatar || (card.aspects && card.aspects.includes('Glow'))) {
                p.passiveUsedThisTurn = true;
            }
        }
    },
    
    getSpellTargetType(card) {
        if (!card.effect) return null;
        const effect = card.effect.toLowerCase();
        
        if (effect.includes('target deity') || effect.includes('target opponent')) {
            return 'deity';
        }
        if (effect.includes('target avatar') || effect.includes('destroy target')) {
            return 'avatar';
        }
        if (effect.includes('target') && (effect.includes('damage') || effect.includes('destroy'))) {
            return 'any';
        }
        return null;
    },
    
    handleSpellEffect(card, playerIndex, target = null) {
        if (!card.effect) return;
        const effect = card.effect.toLowerCase();
        
        if (effect.includes('deal') && effect.includes('essence damage')) {
            const match = effect.match(/deal (\d+)/i);
            if (match) {
                const damage = parseInt(match[1]);
                if (target && target.type === 'deity') {
                    this.animateSpellToDeity(card, target.playerIndex, damage);
                } else {
                    this.animateSpellToDeity(card, 1 - playerIndex, damage);
                }
            }
        }
        
        if (effect.includes('destroy target avatar') && target && target.type === 'avatar') {
            this.animateSpellToAvatar(card, target.card, target.playerIndex);
            setTimeout(() => {
                this.destroyAvatar(target.card, target.playerIndex);
            }, 600);
        }
        
        if (effect.includes('restore') && effect.includes('essence') && effect.includes('your')) {
            const match = effect.match(/restore (\d+)/i);
            if (match) {
                const amount = parseInt(match[1]);
                this.adjustStat(playerIndex, 'essence', amount);
                this.log(`${card.name}: Restored ${amount} Essence`, 'heal');
                this.animateSpellEffect(card, 'heal');
            }
        }
        
        if (effect.includes('opponent loses') && effect.includes('essence')) {
            const match = effect.match(/loses (\d+)/i);
            if (match) {
                const amount = parseInt(match[1]);
                this.animateSpellToDeity(card, 1 - playerIndex, amount);
            }
        }
        
        if (effect.includes('draw')) {
            const match = effect.match(/draw (\d+|a) card/i);
            if (match) {
                const num = match[1] === 'a' ? 1 : parseInt(match[1]);
                this.drawCardEffect(playerIndex, num);
                this.log(`${card.name}: Drew ${num} card(s)`, 'action');
            }
        }
        
        if (effect.includes('gain') && effect.includes('kl')) {
            const match = effect.match(/\+(\d+) kl|gain (\d+) kl/i);
            if (match) {
                const amount = parseInt(match[1] || match[2]);
                this.adjustStat(playerIndex, 'kl', amount);
                this.log(`${card.name}: Gained +${amount} KL`, 'action');
            }
        }
        
        if (effect.includes('both deities gain')) {
            const match = effect.match(/gain (\d+) essence/i);
            if (match) {
                const amount = parseInt(match[1]);
                this.adjustStat(0, 'essence', amount);
                this.adjustStat(1, 'essence', amount);
                this.log(`${card.name}: Both Deities gained ${amount} Essence`, 'heal');
                this.animateSpellEffect(card, 'heal');
            }
        }
    },
    
    selectSpellTarget(target, playerIndex) {
        if (!this.state.spell.mode || !this.state.spell.pendingSpell) return;
        
        const spell = this.state.spell.pendingSpell;
        const casterIndex = this.state.currentPlayer;
        const p = this.state.players[casterIndex];
        
        const handIndex = p.hand.findIndex(c => c.instanceId === spell.instanceId);
        if (handIndex !== -1) {
            p.hand.splice(handIndex, 1);
            p.klCurrent -= spell.cost;
            p.graveyard.push(spell);
            this.state.cardsPlayedThisTurn++;
            this.state.spellsPlayedThisTurn++;
            
            this.log(`Player ${casterIndex + 1} cast ${spell.name} on ${target.name || 'target'}!`, 'action');
            this.handleSpellEffect(spell, casterIndex, { type: target.type, card: target.card, playerIndex: playerIndex, name: target.name });
            this.handleDeitySpellPassive(casterIndex);
            this.handleAspectTrigger(spell, casterIndex);
        }
        
        this.state.spell.mode = null;
        this.state.spell.pendingSpell = null;
        this.state.spell.targetType = null;
        this.hidePrompt();
        this.render();
    },
    
    cancelSpellTargeting() {
        this.state.spell.mode = null;
        this.state.spell.pendingSpell = null;
        this.state.spell.targetType = null;
        this.hidePrompt();
        this.render();
    },
    
    animateSpellToDeity(spell, targetPlayerIndex, damage) {
        const overlay = document.getElementById('ai-play-overlay');
        if (!overlay) return;
        
        const aspectClass = spell.aspects && spell.aspects[0] ? spell.aspects[0].toLowerCase() : '';
        
        overlay.innerHTML = `
            <div class="spell-cast-container">
                <div class="spell-cast-card ${aspectClass}">
                    <img src="${spell.image}" alt="${spell.name}">
                    <div class="spell-cast-info">
                        <div class="spell-cast-name">${spell.name}</div>
                    </div>
                </div>
                <div class="spell-cast-arrow">⚡</div>
                <div class="spell-target-deity">
                    <div class="target-deity-name">Player ${targetPlayerIndex + 1}'s Deity</div>
                    <div class="spell-damage-preview">-${damage} Essence</div>
                </div>
            </div>
        `;
        
        overlay.classList.add('visible');
        
        setTimeout(() => {
            this.adjustStat(targetPlayerIndex, 'essence', -damage);
            this.log(`${spell.name}: Dealt ${damage} damage to Player ${targetPlayerIndex + 1}`, 'damage');
            this.spawnDamageNumber(targetPlayerIndex === 0 ? 'p1-deity' : 'p2-deity', damage);
            this.screenShake(damage >= 3 ? 'heavy' : 'light');
        }, 400);
        
        setTimeout(() => {
            overlay.classList.remove('visible');
        }, 1200);
    },
    
    animateSpellToAvatar(spell, targetCard, targetPlayerIndex) {
        const overlay = document.getElementById('ai-play-overlay');
        if (!overlay) return;
        
        const aspectClass = spell.aspects && spell.aspects[0] ? spell.aspects[0].toLowerCase() : '';
        
        overlay.innerHTML = `
            <div class="spell-cast-container">
                <div class="spell-cast-card ${aspectClass}">
                    <img src="${spell.image}" alt="${spell.name}">
                    <div class="spell-cast-info">
                        <div class="spell-cast-name">${spell.name}</div>
                    </div>
                </div>
                <div class="spell-cast-arrow">💥</div>
                <div class="spell-target-avatar">
                    <img src="${targetCard.image}" alt="${targetCard.name}">
                    <div class="spell-target-name">${targetCard.name}</div>
                </div>
            </div>
        `;
        
        overlay.classList.add('visible');
        this.screenShake('heavy');
        
        setTimeout(() => {
            overlay.classList.remove('visible');
        }, 1000);
    },
    
    animateSpellEffect(spell, effectType) {
        const overlay = document.getElementById('ai-play-overlay');
        if (!overlay) return;
        
        const aspectClass = spell.aspects && spell.aspects[0] ? spell.aspects[0].toLowerCase() : '';
        const icon = effectType === 'heal' ? '✨' : effectType === 'damage' ? '💥' : '⚡';
        
        overlay.innerHTML = `
            <div class="spell-cast-container">
                <div class="spell-cast-card ${aspectClass}">
                    <img src="${spell.image}" alt="${spell.name}">
                    <div class="spell-cast-info">
                        <div class="spell-cast-name">${spell.name}</div>
                    </div>
                </div>
                <div class="spell-effect-icon">${icon}</div>
            </div>
        `;
        
        overlay.classList.add('visible');
        
        setTimeout(() => {
            overlay.classList.remove('visible');
        }, 800);
    },
    
    destroyAvatar(card, playerIndex) {
        const p = this.state.players[playerIndex];
        let zone = 'avatarRow';
        let idx = p.avatarRow.findIndex(c => c.instanceId === card.instanceId);
        if (idx === -1) {
            zone = 'domainRow';
            idx = p.domainRow.findIndex(c => c.instanceId === card.instanceId);
        }
        
        if (idx !== -1) {
            const destroyed = p[zone].splice(idx, 1)[0];
            p.graveyard.push(destroyed);
            this.log(`${card.name} was destroyed!`, 'damage');
            this.emitEvent('ON_AVATAR_DESTROYED', { card: destroyed, playerIndex, zone });
            this.handleOnDeathTrigger(card, playerIndex);
            this.render();
        }
    },

    animateCardPlay(card) {
        const handCards = document.querySelectorAll('#player-hand .game-card');
        handCards.forEach(el => {
            if (el.dataset.cardId === String(card.instanceId)) {
                if (card.type === 'Spell') {
                    el.classList.add('spell-casting');
                    BattleEffects.spellCast(el, card.aspects || []);
                    setTimeout(() => {
                        this.render();
                    }, 800);
                } else {
                    el.classList.add('card-playing');
                }
            }
        });
        
        setTimeout(() => {
            if (card.type === 'Avatar' || card.type === 'Domain' || card.type === 'Relic') {
                const playedCard = document.querySelector(`[data-card-id="${card.instanceId}"]`);
                if (playedCard) {
                    BattleEffects.cardSummon(playedCard, card.type);
                    const slot = playedCard.closest('.ec-card-slot');
                    if (slot) {
                        AnimationHelper.play('manifest', slot);
                    }
                }
            }
        }, 100);
    },

    handleAspectTrigger(card, playerIndex) {
        if (!this.state.rulesHelper) return;
        
        const aspects = card.aspects || (card.aspect ? [card.aspect] : []);
        const mainAspect = getMainAspect(card);
        
        if (mainAspect === 'Glow') {
            this.adjustStat(playerIndex, 'essence', 1);
            this.log('Glow aspect: +1 Essence', 'heal');
        } else if (mainAspect === 'Void') {
            this.adjustStat(1 - playerIndex, 'essence', -1);
            this.log('Void aspect: -1 to opponent', 'damage');
        } else if (mainAspect === 'Gray') {
            this.drawCardEffect(playerIndex);
            this.log('Gray aspect: Draw 1', 'action');
        }
    },
    
    drawCardEffect(playerIndex, count = 1) {
        const p = this.state.players[playerIndex];
        for (let i = 0; i < count; i++) {
            if (p.deck.length > 0) {
                const card = p.deck.pop();
                p.hand.push(card);
                this.log(`Player ${playerIndex + 1} drew ${card.name}`, 'action');
            }
        }
        this.render();
    },

    moveCard(card, fromZone, toZone, playerIndex) {
        const p = this.state.players[playerIndex];
        
        const removeFrom = (zone) => {
            const idx = p[zone].findIndex(c => c.instanceId === card.instanceId);
            if (idx > -1) p[zone].splice(idx, 1);
        };
        
        ['hand', 'avatarRow', 'domainRow', 'graveyard', 'banished', 'deck', 'relicRow', 'spellRow'].forEach(removeFrom);
        
        if (toZone === 'deckTop') {
            p.deck.push(card);
        } else if (toZone === 'deckBottom') {
            p.deck.unshift(card);
        } else {
            p[toZone].push(card);
        }
        
        this.render();
    },

    showContextMenu(e, card) {
        e.preventDefault();
        e.stopPropagation();
        const menu = document.getElementById('context-menu');
        this.state.contextCard = card;
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('visible');
    },

    hideContextMenu() {
        document.getElementById('context-menu').classList.remove('visible');
    },

    handleContextAction(action) {
        const card = this.state.contextCard;
        if (!card) return;
        
        const playerIndex = 0;
        
        switch(action) {
            case 'play':
                this.playCard(card, playerIndex);
                break;
            case 'tap':
                card.tapped = !card.tapped;
                break;
            case 'flip':
                card.faceDown = !card.faceDown;
                break;
            case 'to-hand':
                this.moveCard(card, null, 'hand', playerIndex);
                break;
            case 'to-discard':
                this.moveCard(card, null, 'graveyard', playerIndex);
                break;
            case 'to-exile':
                this.moveCard(card, null, 'banished', playerIndex);
                break;
        }
        
        this.hideContextMenu();
        this.render();
    },

    viewPile(playerIndex, pileName) {
        const p = this.state.players[playerIndex];
        const pile = p[pileName];
        this.showPileOverlay(pile, pileName, playerIndex);
    },
    
    showPileOverlay(pile, pileName, playerIndex) {
        const overlay = document.getElementById('pile-overlay');
        if (!overlay) return;
        
        const title = pileName === 'graveyard' ? 'GRAVEYARD' : pileName.toUpperCase();
        
        let cardsHtml = '';
        if (pile.length === 0) {
            cardsHtml = '<div class="pile-empty">No cards</div>';
        } else {
            pile.forEach(card => {
                cardsHtml += `
                    <div class="pile-card ${card.aspects && card.aspects[0] ? card.aspects[0].toLowerCase() : ''}">
                        <img src="${card.image}" alt="${card.name}">
                        <div class="pile-card-info">
                            <div class="pile-card-name">${card.name}</div>
                            <div class="pile-card-cost">${card.cost} KL</div>
                            ${card.attack !== undefined ? `<div class="pile-card-stats">${card.attack}/${card.health}</div>` : ''}
                            ${card.effect ? `<div class="pile-card-effect">${card.effect}</div>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        
        overlay.innerHTML = `
            <div class="pile-container">
                <div class="pile-header">
                    <h2>Player ${playerIndex + 1} ${title}</h2>
                    <span class="pile-count">${pile.length} cards</span>
                    <button class="pile-close" onclick="Game.closePileOverlay()">X</button>
                </div>
                <div class="pile-cards">
                    ${cardsHtml}
                </div>
            </div>
        `;
        
        overlay.classList.add('visible');
    },
    
    closePileOverlay() {
        document.getElementById('pile-overlay')?.classList.remove('visible');
    },
    
    showCardPreview(card) {
        const preview = document.getElementById('card-preview');
        if (!preview || !card) return;
        
        if (this.state.previewTimeout) {
            clearTimeout(this.state.previewTimeout);
            this.state.previewTimeout = null;
        }
        
        const aspectClass = card.aspects && card.aspects[0] ? card.aspects[0].toLowerCase() : '';
        
        preview.innerHTML = `
            <div class="preview-card ${aspectClass}">
                <img src="${card.image}" alt="${card.name}">
                <div class="preview-info">
                    <div class="preview-name">${card.name}</div>
                    <div class="preview-type">${card.type} ${card.rarity ? '- ' + card.rarity : ''}</div>
                    <div class="preview-cost">${card.cost} KL</div>
                    ${card.attack !== undefined ? `<div class="preview-stats">Power: ${card.attack} | Health: ${card.health}</div>` : ''}
                    ${card.effect ? `<div class="preview-effect">${card.effect}</div>` : ''}
                    ${card.passive ? `<div class="preview-passive"><strong>${card.passive}:</strong> ${card.passiveText || ''}</div>` : ''}
                    ${card.godCode ? `<div class="preview-godcode"><strong>${card.godCode}:</strong> ${card.godCodeText || ''}</div>` : ''}
                </div>
            </div>
        `;
        
        preview.classList.add('visible');
        
        this.updateCodexView(card);
    },
    
    updateCodexView(card) {
        if (!card) return;
        const codexName = document.getElementById('codex-name');
        const codexMeta = document.getElementById('codex-meta');
        const codexBody = document.getElementById('codex-body');
        const codexFlavor = document.getElementById('codex-flavor');
        
        if (codexName) codexName.textContent = card.name || 'Unknown Card';
        if (codexMeta) {
            codexMeta.innerHTML = `
                <span class="ec-meta-type">${card.type || 'Card'}${card.rarity ? ' • ' + card.rarity : ''}</span>
                ${card.cost !== undefined ? `<span class="ec-meta-cost">⚡ ${card.cost} KL</span>` : ''}
                ${card.attack !== undefined ? `<span class="ec-meta-stats">⚔ ${card.attack} / ❤ ${card.health}</span>` : ''}
            `;
        }
        if (codexBody) {
            let bodyHTML = '';
            if (card.effect) {
                bodyHTML += this.formatCardEffect(card.effect);
            }
            if (card.passive) {
                bodyHTML += `<span class="ec-ability ec-ability-active"><span class="ec-ability-name">${card.passive}:</span> ${card.passiveText || ''}</span>`;
            }
            if (card.godCode) {
                bodyHTML += `<span class="ec-ability ec-ability-crownbound"><span class="ec-ability-name">${card.godCode}:</span> ${card.godCodeText || ''}</span>`;
            }
            codexBody.innerHTML = bodyHTML || 'No special effects.';
        }
        if (codexFlavor) codexFlavor.textContent = card.flavor || '';
    },
    
    formatCardEffect(effect) {
        if (!effect) return '';
        const keywords = [
            { pattern: /\b(Manifest:)/gi, class: 'ec-ability-manifest', name: 'Manifest' },
            { pattern: /\b(On Play:)/gi, class: 'ec-ability-manifest', name: 'On Play' },
            { pattern: /\b(Active:)/gi, class: 'ec-ability-active', name: 'Active' },
            { pattern: /\b(Cycle:)/gi, class: 'ec-ability-cycle', name: 'Cycle' },
            { pattern: /\b(Crownbound:)/gi, class: 'ec-ability-crownbound', name: 'Crownbound' },
            { pattern: /\b(When.*?:)/gi, class: 'ec-ability-active', name: 'When' }
        ];
        
        let formatted = effect;
        keywords.forEach(kw => {
            formatted = formatted.replace(kw.pattern, `<span class="ec-ability-name">$1</span>`);
        });
        
        const lines = formatted.split(/[.!]\s+/).filter(l => l.trim());
        if (lines.length > 1) {
            return lines.map(line => `<span class="ec-ability">${line.trim()}.</span>`).join('');
        }
        return `<span class="ec-ability">${formatted}</span>`;
    },
    
    hideCardPreview() {
        this.state.previewTimeout = setTimeout(() => {
            document.getElementById('card-preview')?.classList.remove('visible');
            this.state.previewTimeout = null;
        }, 50);
    },

    toggleRulesHelper() {
        this.state.rulesHelper = !this.state.rulesHelper;
        const btn = document.getElementById('btn-rules-helper');
        btn.classList.toggle('active', this.state.rulesHelper);
        btn.textContent = this.state.rulesHelper ? 'Auto' : 'Man';
        this.log(`Rules Helper: ${this.state.rulesHelper ? 'ON - Automatic play assistance enabled' : 'OFF - Manual play'}`, 'phase');
        this.highlightLegalPlays();
    },

    toggleLog() {
        this.state.logVisible = !this.state.logVisible;
        const logPanel = document.getElementById('log-panel');
        const chroniclePanel = document.querySelector('.ec-panel--chronicle');
        const logBtn = document.getElementById('btn-log');
        
        if (logPanel) logPanel.classList.toggle('visible', this.state.logVisible);
        if (chroniclePanel) chroniclePanel.classList.toggle('open', this.state.logVisible);
        if (logBtn) logBtn.classList.toggle('active', this.state.logVisible);
    },

    toggleSettings() {
        this.state.settingsVisible = !this.state.settingsVisible;
        document.getElementById('settings-modal').classList.toggle('visible', this.state.settingsVisible);
        document.getElementById('btn-settings').classList.toggle('active', this.state.settingsVisible);
    },

    // ==================== CODEX SYSTEM ====================
    toggleCodex() {
        this.state.codexVisible = !this.state.codexVisible;
        const overlay = document.getElementById('codex-overlay');
        if (this.state.codexVisible) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    },
    
    switchCodexTab(tabId) {
        document.querySelectorAll('.codex-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.codex-section').forEach(s => s.classList.remove('active'));
        
        document.querySelector(`.codex-tab[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`codex-${tabId}`).classList.add('active');
    },

    // ==================== CARD ZOOM SYSTEM ====================
    showCardZoom(card) {
        if (!card) return;
        
        const panel = document.getElementById('card-zoom-panel');
        document.getElementById('zoom-card-image').src = card.image || '';
        document.getElementById('zoom-card-name').textContent = card.name || 'Unknown Card';
        document.getElementById('zoom-card-type').textContent = card.type || 'Unknown';
        
        const aspectEl = document.getElementById('zoom-card-aspect');
        const aspects = card.aspects || (card.aspect ? [card.aspect] : []);
        if (aspects.length > 0) {
            aspectEl.textContent = aspects.join(' / ');
            aspectEl.className = 'zoom-aspect ' + aspects[0].toLowerCase();
        } else {
            aspectEl.textContent = '';
        }
        
        const costEl = document.getElementById('zoom-card-cost');
        costEl.textContent = card.cost ? `Cost: ${card.cost} KL` : '';
        
        const statsRow = document.getElementById('zoom-card-stats-row');
        if (card.attack !== undefined && card.health !== undefined) {
            statsRow.innerHTML = `<div class="zoom-stat"><span class="stat-label">Attack:</span> ${card.attack}</div><div class="zoom-stat"><span class="stat-label">Health:</span> ${card.healthCurrent || card.health}</div>`;
        } else {
            statsRow.innerHTML = '';
        }
        
        const effectEl = document.getElementById('zoom-card-effect');
        effectEl.innerHTML = card.effect ? `<p><strong>Effect:</strong> ${card.effect}</p>` : '';
        if (card.passive) {
            effectEl.innerHTML += `<p><strong>${card.passive}:</strong> ${card.passiveText || ''}</p>`;
        }
        if (card.godCode) {
            effectEl.innerHTML += `<p><strong>GOD CODE - ${card.godCode}:</strong> ${card.godCodeText || ''}</p>`;
        }
        
        const rarityEl = document.getElementById('zoom-card-rarity');
        rarityEl.textContent = card.rarity ? `Rarity: ${card.rarity}` : '';
        
        panel.classList.remove('hidden');
        this.log(`Zoomed: ${card.name}`, 'action');
    },
    
    hideCardZoom() {
        document.getElementById('card-zoom-panel')?.classList.add('hidden');
    },

    // ==================== TUTORIAL SYSTEM ====================
    tutorialSteps: [
        {
            title: "Welcome to Essence Crown!",
            text: "This tutorial will teach you the basics of the game. Let's start with the most important concept: Essence!",
            target: null,
            position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        },
        {
            title: "Essence (Life Total)",
            text: "This is your Essence - your life total. If it reaches 0, you lose! Your starting Essence depends on your Deity (usually 20-25).",
            target: '#p1-life-badge',
            arrow: 'left'
        },
        {
            title: "Kundalini (KL)",
            text: "KL is your energy resource used to play cards. It starts at 3, grows each turn (max 13), and refills at the start of each turn.",
            target: '#p1-kl-badge',
            arrow: 'left'
        },
        {
            title: "Your Deity",
            text: "This is your Deity - a powerful Sovereign with a Passive ability (always active) and a God Code (ultimate ability).",
            target: '#p1-deity-zone',
            arrow: 'right'
        },
        {
            title: "Phase Tracker",
            text: "The game flows through 5 phases: Dawn (upkeep), Draw (draw a card), Main (play cards), Clash (combat), and Twilight (end turn).",
            target: '#phase-tracker',
            arrow: 'up'
        },
        {
            title: "Your Hand",
            text: "These are the cards in your hand. During the Main phase, you can play them by spending KL. Hover over cards to see details!",
            target: '#hand-zone',
            arrow: 'down'
        },
        {
            title: "Avatar Zone",
            text: "Avatars (creatures) go here when summoned. They can attack during the Clash phase to damage enemy Avatars or the enemy Deity.",
            target: '#p1-avatar-row',
            arrow: 'up'
        },
        {
            title: "Domain/Spell Zone",
            text: "Domains go in the first slot and provide ongoing effects. Spells and Relics use the other slots.",
            target: '#p1-domain-row',
            arrow: 'up'
        },
        {
            title: "Aspects",
            text: "Cards have Aspects: Glow (heals you), Void (damages opponent), and Gray (draws cards). These trigger when played!",
            target: null,
            position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        },
        {
            title: "Rules Helper",
            text: "The 'Auto' button toggles the Rules Helper. When ON, the game handles phases and triggers automatically. Turn it OFF for full manual control.",
            target: '#btn-rules-helper',
            arrow: 'left'
        },
        {
            title: "Ready to Play!",
            text: "You're ready to start! Click 'Next Phase' to advance, play cards from your hand, and attack during Clash. Good luck, Sovereign!",
            target: null,
            position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        }
    ],
    
    startTutorial() {
        TutorialController.start();
    },
    
    showTutorialStep() {
        const step = this.tutorialSteps[this.state.tutorialStep];
        if (!step) {
            this.endTutorial();
            return;
        }
        
        const box = document.querySelector('.tutorial-box');
        const arrow = document.querySelector('.tutorial-arrow');
        const title = document.getElementById('tutorial-title');
        const text = document.getElementById('tutorial-text');
        const prevBtn = document.getElementById('btn-tutorial-prev');
        
        title.textContent = step.title;
        text.textContent = step.text;
        
        prevBtn.style.display = this.state.tutorialStep === 0 ? 'none' : 'inline-block';
        
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        arrow.className = 'tutorial-arrow';
        
        if (step.target) {
            const target = document.querySelector(step.target);
            if (target) {
                target.classList.add('tutorial-highlight');
                const rect = target.getBoundingClientRect();
                
                if (step.arrow === 'up') {
                    box.style.top = (rect.bottom + 50) + 'px';
                    box.style.left = (rect.left + rect.width / 2) + 'px';
                    box.style.transform = 'translateX(-50%)';
                    arrow.classList.add('arrow-up');
                } else if (step.arrow === 'down') {
                    box.style.top = (rect.top - 200) + 'px';
                    box.style.left = (rect.left + rect.width / 2) + 'px';
                    box.style.transform = 'translateX(-50%)';
                    arrow.classList.add('arrow-down');
                } else if (step.arrow === 'left') {
                    box.style.top = (rect.top + rect.height / 2) + 'px';
                    box.style.left = (rect.right + 50) + 'px';
                    box.style.transform = 'translateY(-50%)';
                    arrow.classList.add('arrow-left');
                } else if (step.arrow === 'right') {
                    box.style.top = (rect.top + rect.height / 2) + 'px';
                    box.style.left = (rect.left - 420) + 'px';
                    box.style.transform = 'translateY(-50%)';
                    arrow.classList.add('arrow-right');
                }
            }
        } else if (step.position) {
            Object.assign(box.style, step.position);
        }
    },
    
    nextTutorialStep() {
        this.state.tutorialStep++;
        if (this.state.tutorialStep >= this.tutorialSteps.length) {
            this.endTutorial();
        } else {
            this.showTutorialStep();
        }
    },
    
    prevTutorialStep() {
        if (this.state.tutorialStep > 0) {
            this.state.tutorialStep--;
            this.showTutorialStep();
        }
    },
    
    endTutorial() {
        this.state.tutorialMode = false;
        document.getElementById('tutorial-overlay').classList.add('hidden');
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    },

    // ==================== MOBILE PANEL SYSTEM ====================
    switchMobilePanel(panel) {
        document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.mobile-tab[data-panel="${panel}"]`).classList.add('active');
        
        document.getElementById('hand-zone').style.display = panel === 'hand' ? 'block' : 'none';
        document.getElementById('shard-chain-panel').style.display = panel === 'chain' ? 'block' : 'none';
        document.getElementById('log-panel').style.display = panel === 'log' ? 'block' : 'none';
        
        if (panel === 'log') {
            document.getElementById('log-panel').classList.add('visible');
        }
    },

    // ==================== LEGAL PLAY HIGHLIGHTING ====================
    highlightLegalPlays() {
        if (!this.state.rulesHelper) return;
        
        document.querySelectorAll('.legal-play').forEach(el => el.classList.remove('legal-play'));
        document.querySelectorAll('.legal-target').forEach(el => el.classList.remove('legal-target'));
        
        if (this.state.currentPlayer !== 0) return;
        
        const p = this.state.players[0];
        
        if (this.state.currentPhase === 'main') {
            const handCards = document.querySelectorAll('#player-hand .hand-card');
            handCards.forEach((cardEl, i) => {
                const card = p.hand[i];
                if (card && card.cost <= p.klCurrent) {
                    cardEl.classList.add('legal-play');
                }
            });
        }
        
        if (this.state.currentPhase === 'clash' && this.state.combat.mode === 'selectAttacker') {
            const frontCards = document.querySelectorAll('#p1-avatar-row .game-card');
            frontCards.forEach(cardEl => {
                const cardId = parseInt(cardEl.dataset.instanceId);
                const canAttack = !this.state.combat.attackedThisTurn.includes(cardId) &&
                                  !this.state.combat.summonedThisTurn.includes(cardId);
                if (canAttack) {
                    cardEl.classList.add('legal-play');
                }
            });
        }
        
        if (this.state.combat.mode === 'selectTarget') {
            const targets = document.querySelectorAll('#p2-avatar-row .game-card');
            targets.forEach(cardEl => cardEl.classList.add('legal-target'));
            
            const guardians = this.getGuardians(1);
            if (guardians.length === 0) {
                document.getElementById('p2-deity-zone').classList.add('legal-target');
            }
        }
    },

    log(message, type = 'action') {
        MatchRecorder.recordAction('LOG', { message, type }, this.state.currentPlayer);
        
        const content = document.getElementById('log-content');
        if (!content) return;
        const entry = document.createElement('div');
        entry.className = `ec-chronicle-entry ${type}`;
        const turnNum = this.state?.turnNumber || 1;
        entry.innerHTML = `<span class="chronicle-turn">T${turnNum}</span> ${message}`;
        content.insertBefore(entry, content.firstChild);
        
        if (content.children.length > 50) {
            content.removeChild(content.lastChild);
        }
    },

    render() {
        this.renderStats();
        this.renderDeities();
        this.renderBoard();
        this.renderHand();
        this.highlightLegalPlays();
    },

    renderStats() {
        for (let p = 0; p < 2; p++) {
            const prefix = p === 0 ? 'p1' : 'p2';
            const player = this.state.players[p];
            
            const essenceEl = document.getElementById(`${prefix}-essence`);
            const klEl = document.getElementById(`${prefix}-kl`);
            const deckEl = document.getElementById(`${prefix}-deck-count`);
            const discardEl = document.getElementById(`${prefix}-graveyard-count`);
            
            if (essenceEl) essenceEl.textContent = player.essence;
            if (klEl) klEl.textContent = `${player.klCurrent}/${player.klMax}`;
            if (deckEl) deckEl.textContent = player.deck.length;
            if (discardEl) discardEl.textContent = player.graveyard.length;
            
            const essenceBar = document.getElementById(`${prefix}-essence-bar`);
            if (essenceBar) {
                const percent = Math.min(100, (player.essence / 23) * 100);
                essenceBar.style.width = `${percent}%`;
            }
            
            const playmatEssence = document.getElementById(`${prefix}-essence-display`);
            if (playmatEssence) playmatEssence.textContent = player.essence;
            
            const playmatDeck = document.getElementById(`${prefix}-deck-count-display`);
            if (playmatDeck) playmatDeck.textContent = player.deck.length;
        }
        
        const handInfo = document.getElementById('hand-info');
        if (handInfo && this.state.players[0]) {
            const p = this.state.players[0];
            handInfo.textContent = `${p.hand.length} cards • ${p.klCurrent} KL`;
        }
        
        const deckPileCount = document.getElementById('deck-pile-count');
        if (deckPileCount && this.state.players[0]) {
            deckPileCount.textContent = this.state.players[0].deck.length;
        }
        
        const graveyardPileCount = document.getElementById('graveyard-pile-count');
        if (graveyardPileCount && this.state.players[0]) {
            graveyardPileCount.textContent = this.state.players[0].graveyard.length;
        }
        
        const deckPile = document.getElementById('deck-pile');
        if (deckPile) {
            if (this.state.currentPhase === 'draw' && 
                this.state.currentPlayer === 0 && 
                this.state.drawsThisTurn < 1 &&
                this.state.players[0].deck.length > 0) {
                deckPile.classList.add('can-draw');
            } else {
                deckPile.classList.remove('can-draw');
            }
        }
    },

    renderDeities() {
        for (let p = 0; p < 2; p++) {
            const prefix = p === 0 ? 'p1' : 'p2';
            const player = this.state.players[p];
            const deity = player.deity;
            const frame = document.getElementById(`${prefix}-deity`);
            const nameLabel = document.getElementById(`${prefix}-deity-name`);
            const playmatSlot = document.getElementById(`${prefix}-deity-slot`);
            
            if (deity && frame) {
                const godCodeAvailable = player.godCodeCharges > 0 && !player.godCodeUsed && p === this.state.currentPlayer;
                const passiveText = deity.passive ? `${deity.passive}` : '';
                
                frame.innerHTML = `
                    <img src="${deity.image}" alt="${deity.name}">
                    <div class="deity-info-overlay">
                        <div class="deity-passive" title="${deity.passiveText || ''}">${passiveText}</div>
                        <div class="god-code-charges">
                            <span class="charge ${player.godCodeCharges >= 1 ? 'active' : ''}"></span>
                            <span class="charge ${player.godCodeCharges >= 2 ? 'active' : ''}"></span>
                        </div>
                        ${godCodeAvailable ? `<button class="god-code-btn" onclick="Game.activateGodCode(${p})">GOD CODE</button>` : ''}
                    </div>
                    <div class="deity-overflow">OF: ${player.overflow}/13</div>
                `;
                
                frame.onclick = () => {
                    if (this.state.spell.mode === 'selectTarget') {
                        const targetType = this.state.spell.targetType;
                        if (targetType === 'deity' || targetType === 'any') {
                            this.selectSpellTarget({ type: 'deity', name: `Player ${p + 1}'s Deity` }, p);
                        }
                    } else if (this.state.combat.mode === 'selectTarget') {
                        this.attackDeity(p);
                    }
                };

                if (this.state.spell.mode === 'selectTarget') {
                    const targetType = this.state.spell.targetType;
                    if ((targetType === 'deity' || targetType === 'any') && p !== this.state.currentPlayer) {
                        frame.classList.add('valid-spell-target');
                    } else {
                        frame.classList.remove('valid-spell-target');
                    }
                } else if (this.state.combat.mode === 'selectTarget' && p !== this.state.currentPlayer) {
                    frame.classList.add('valid-deity-target');
                } else {
                    frame.classList.remove('valid-deity-target');
                    frame.classList.remove('valid-spell-target');
                }
            }
            if (deity && nameLabel) {
                nameLabel.textContent = deity.name;
            }
            
            if (deity && playmatSlot) {
                const deityCard = this.createCardElement(deity, false, p);
                deityCard.classList.add('deity-card', 'playmat-deity');
                playmatSlot.innerHTML = '';
                playmatSlot.appendChild(deityCard);
            }
        }
    },
    
    activateGodCode(playerIndex) {
        const p = this.state.players[playerIndex];
        const deity = p.deity;
        
        if (!deity || p.godCodeCharges <= 0 || p.godCodeUsed) {
            this.showPrompt('God Code not available!');
            return;
        }
        
        if (playerIndex !== this.state.currentPlayer) {
            this.showPrompt('You can only activate your own God Code!');
            return;
        }
        
        p.godCodeCharges--;
        p.godCodeUsed = true;
        
        this.log(`${deity.name} activates ${deity.godCode}!`, 'phase');
        this.emitEvent('ON_DEITY_ABILITY_USED', { deity, playerIndex, godCode: deity.godCode });
        this.spawnParticles({ type: 'effect' }, 'gold');
        this.screenShake('heavy');
        
        this.executeGodCode(playerIndex, deity);
        this.render();
    },
    
    executeGodCode(playerIndex, deity) {
        const godCode = deity.godCode;
        
        if (godCode === 'Crown of the Second Sun') {
            this.state.players[playerIndex].avatarRow.forEach(c => c.attack += 2);
            this.state.players[playerIndex].domainRow.forEach(c => c.attack += 2);
            this.adjustStat(1 - playerIndex, 'essence', -4);
            this.log('Avatars gain +2 Power, opponent loses 4 Essence!', 'damage');
        }
        else if (godCode === 'Crown of Absolute Zero') {
            this.adjustStat(1 - playerIndex, 'kl', -3);
            this.adjustStat(1 - playerIndex, 'essence', -3);
            this.log('Opponent loses 3 KL and 3 Essence!', 'damage');
        }
        else if (godCode === 'Final Arbitration') {
            const minEssence = Math.min(
                this.state.players[0].essence,
                this.state.players[1].essence
            );
            this.state.players[0].essence = minEssence;
            this.state.players[1].essence = minEssence;
            this.adjustStat(playerIndex, 'essence', 3);
            this.log(`Both Deities set to ${minEssence} Essence, then you gain 3!`, 'action');
        }
        else if (godCode === 'Call of the Crown Pride') {
            for (let i = 0; i < 3; i++) {
                const token = this.createCardInstance({
                    id: `TOKEN-${Date.now()}-${i}`,
                    name: 'Glow Beast Token',
                    type: 'Avatar',
                    aspects: ['Glow', 'Beast'],
                    cost: 0,
                    attack: 2,
                    health: 2,
                    effect: 'Guardian',
                    keywords: ['Guardian', 'Beast'],
                    image: CARD_BACK_URL
                });
                if (this.state.players[playerIndex].avatarRow.length < 5) {
                    this.state.players[playerIndex].avatarRow.push(token);
                }
            }
            this.adjustStat(playerIndex, 'essence', 3);
            this.log('Created 3 Glow Beast tokens with Guardian, restored 3 Essence!', 'heal');
        }
        else if (godCode === 'Absolute Schedule Lock') {
            this.log('Opponent cannot gain extra KL or draw extra cards next turn!', 'action');
        }
        else if (godCode === 'Golden Aura Cascade') {
            this.state.players[playerIndex].avatarRow.forEach(c => c.attack += 1);
            this.log('Your Avatars gain +1 Power and lifesteal this turn!', 'heal');
        }
        else if (godCode === 'Canon Rewrite') {
            const p = this.state.players[playerIndex];
            p.banished.push(...p.hand);
            p.hand = [];
            this.drawCardEffect(playerIndex, 5);
            this.log('Exiled hand, drew 5 cards! Spells cost 1 less this turn!', 'action');
        }
        else if (godCode === 'Sanctuary Eclipse') {
            const opponent = this.state.players[1 - playerIndex];
            let destroyed = 0;
            opponent.avatarRow = opponent.avatarRow.filter(c => {
                if (!isBeast(c) && destroyed < 2) {
                    opponent.graveyard.push(c);
                    destroyed++;
                    return false;
                }
                return true;
            });
            for (let i = 0; i < destroyed; i++) {
                const token = this.createCardInstance({
                    id: `TOKEN-${Date.now()}-${i}`,
                    name: 'Void Beast Token',
                    type: 'Avatar',
                    aspects: ['Void', 'Beast'],
                    cost: 0,
                    attack: 3,
                    health: 3,
                    keywords: ['Beast'],
                    image: CARD_BACK_URL
                });
                if (this.state.players[playerIndex].avatarRow.length < 5) {
                    this.state.players[playerIndex].avatarRow.push(token);
                }
            }
            this.log(`Destroyed ${destroyed} non-Beast Avatars, created ${destroyed} Void Beast tokens!`, 'damage');
        }
        else if (godCode === 'Final Shardstorm') {
            const opponent = this.state.players[1 - playerIndex];
            let sacrificed = 0;
            while (opponent.avatarRow.length > 0 && sacrificed < 2) {
                opponent.graveyard.push(opponent.avatarRow.pop());
                sacrificed++;
            }
            this.adjustStat(1 - playerIndex, 'essence', -4);
            this.state.players[playerIndex].avatarRow.forEach(c => c.attack += 2);
            this.log(`Opponent sacrificed ${sacrificed} Avatars, lost 4 Essence! Your Avatars gain +2 Power!`, 'damage');
        }
        else if (godCode === 'Stillpoint Rewrite') {
            const opponent = this.state.players[1 - playerIndex];
            opponent.avatarRow.forEach(c => c.tapped = true);
            opponent.domainRow.forEach(c => c.tapped = true);
            this.adjustStat(playerIndex, 'essence', 5);
            this.drawCardEffect(playerIndex, 3);
            this.log('Tapped all enemy Avatars, restored 5 Essence, drew 3 cards!', 'heal');
        }
        else {
            this.log(`${deity.godCode} activated!`, 'action');
        }
    },

    renderBoard() {
        console.log('=== RENDER BOARD CALLED ===');
        console.log('P1 Hand:', this.state.players[0].hand.length, 'cards');
        console.log('P1 Deck:', this.state.players[0].deck.length, 'cards');
        console.log('P1 Avatars:', this.state.players[0].avatarRow.length);
        console.log('P1 Domains:', this.state.players[0].domainRow.length);
        
        const zones = [
            { id: 'p1-avatar-row', data: this.state.players[0].avatarRow, player: 0 },
            { id: 'p1-domain-row', data: this.state.players[0].domainRow, player: 0 },
            { id: 'p1-relic-row', data: this.state.players[0].relicRow || [], player: 0 },
            { id: 'p2-avatar-row', data: this.state.players[1].avatarRow, player: 1 },
            { id: 'p2-domain-row', data: this.state.players[1].domainRow, player: 1 },
            { id: 'p2-relic-row', data: this.state.players[1].relicRow || [], player: 1 }
        ];
        
        zones.forEach(zone => {
            const container = document.getElementById(zone.id);
            if (!container) {
                console.warn('Zone not found:', zone.id);
                return;
            }
            
            const slots = container.querySelectorAll('.card-slot, .ec-card-slot, .avatar-slot, .relic-slot, .domain-slot');
            console.log(`Zone ${zone.id}: ${slots.length} slots, ${zone.data.length} cards`);
            
            slots.forEach((slot, i) => {
                const slotLabel = slot.querySelector('.slot-label');
                slot.innerHTML = '';
                if (slotLabel) slot.appendChild(slotLabel);
                
                if (zone.data[i]) {
                    const cardEl = this.createCardElement(zone.data[i], false, zone.player);
                    slot.appendChild(cardEl);
                    slot.classList.add('active');
                } else {
                    slot.classList.remove('active');
                }
            });
        });

        this.renderTurnIndicator();
        this.renderDeckPiles();
    },
    
    renderDeckPiles() {
        for (let p = 0; p < 2; p++) {
            const prefix = p === 0 ? 'p1' : 'p2';
            const player = this.state.players[p];
            
            const deckPile = document.getElementById(`${prefix}-deck-pile`);
            if (deckPile) {
                const stack = deckPile.querySelector('.deck-cards-stack');
                if (stack) {
                    stack.innerHTML = '';
                    const stackSize = Math.min(5, Math.ceil(player.deck.length / 10));
                    for (let i = 0; i < stackSize; i++) {
                        const card = document.createElement('div');
                        card.className = 'deck-stack-card';
                        card.style.bottom = `${i * 2}px`;
                        stack.appendChild(card);
                    }
                }
                const countEl = deckPile.querySelector('.deck-count');
                if (countEl) countEl.textContent = player.deck.length;
            }
            
            const voidPile = document.getElementById(`${prefix}-void-pile`);
            if (voidPile && player.exile) {
                voidPile.textContent = player.exile.length || 0;
            }
            
            const abyssPile = document.getElementById(`${prefix}-abyss-pile`);
            if (abyssPile && player.graveyard) {
                abyssPile.textContent = player.graveyard.length;
            }
        }
    },

    renderTurnIndicator() {
        const indicator = document.getElementById('turn-indicator');
        if (!indicator) return;
        
        indicator.textContent = `Player ${this.state.currentPlayer + 1}'s Turn`;
        indicator.className = `turn-indicator p${this.state.currentPlayer + 1}`;
    },

    renderHand() {
        const handContainer = document.getElementById('player-hand');
        if (!handContainer) {
            console.error('Hand container #player-hand not found!');
            return;
        }
        
        handContainer.innerHTML = '';
        
        const playerHand = this.state.players[0]?.hand || [];
        console.log('Rendering hand with', playerHand.length, 'cards');
        
        playerHand.forEach(card => {
            const cardEl = this.createCardElement(card, true);
            handContainer.appendChild(cardEl);
        });
        
        handContainer.style.display = 'flex';
    },

    createCardElement(card, isHand = false, playerIndex = 0) {
        const el = document.createElement('div');
        const aspectClass = card.aspects && card.aspects.length > 0 ? card.aspects[0].toLowerCase() : (card.aspect ? card.aspect.toLowerCase() : '');
        el.className = `game-card ${aspectClass}`;
        el.dataset.cardId = card.instanceId;
        if (card.tapped) el.classList.add('tapped');
        if (card.faceDown) el.classList.add('face-down');
        
        if (this.state.combat.selectedAttacker?.instanceId === card.instanceId) {
            el.classList.add('selected-attacker');
        }
        
        if (this.state.combat.mode === 'selectTarget' && playerIndex !== this.state.currentPlayer) {
            el.classList.add('valid-target');
        }
        
        if (this.state.spell.mode === 'selectTarget') {
            const targetType = this.state.spell.targetType;
            if ((targetType === 'avatar' || targetType === 'any') && card.type === 'Avatar') {
                el.classList.add('valid-spell-target');
            }
        }
        
        const hasStats = card.type === 'Avatar' && card.attack !== undefined;
        const healthPercent = hasStats ? ((card.healthCurrent || card.health) / card.health) * 100 : 100;
        
        const isGuardian = hasGuardian(card);
        const isCardBeast = isBeast(card);
        
        el.innerHTML = `
            <div class="card-front">
                <img class="card-image" src="${card.image}" alt="${card.name}">
                <div class="card-cost">${card.cost || 0}</div>
                ${isGuardian ? '<div class="guardian-badge">GUARD</div>' : ''}
                ${isCardBeast ? '<div class="beast-badge">BEAST</div>' : ''}
                <div class="card-info">
                    <div class="card-name">${card.name}</div>
                    ${hasStats ? `
                        <div class="card-stats">
                            <span class="stat attack">${card.attack}</span>
                            <span class="stat health">${card.healthCurrent || card.health}</span>
                        </div>
                        <div class="health-bar">
                            <div class="health-fill" style="width: ${healthPercent}%"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        el.oncontextmenu = (e) => this.showContextMenu(e, card);
        
        el.onmouseenter = () => this.showCardPreview(card);
        el.onmouseleave = () => this.hideCardPreview();
        el.ondblclick = (e) => {
            e.stopPropagation();
            this.showCardZoom(card);
        };
        
        if (isHand) {
            el.style.cursor = 'pointer';
            el.onclick = (e) => {
                e.stopPropagation();
                this.playCard(card, 0);
            };
        } else if (card.type === 'Avatar') {
            el.style.cursor = 'pointer';
            el.onclick = (e) => {
                e.stopPropagation();
                if (this.state.spell.mode === 'selectTarget') {
                    const targetType = this.state.spell.targetType;
                    if (targetType === 'avatar' || targetType === 'any') {
                        this.selectSpellTarget({ type: 'avatar', card: card, name: card.name }, playerIndex);
                    }
                } else if (this.state.combat.mode === 'selectAttacker') {
                    this.selectAttacker(card, playerIndex);
                } else if (this.state.combat.mode === 'selectTarget') {
                    this.selectTarget(card, playerIndex);
                } else if (this.state.currentPhase === 'clash' && playerIndex === this.state.currentPlayer) {
                    this.enterCombatMode();
                    this.selectAttacker(card, playerIndex);
                }
            };
        }
        
        return el;
    },

    showFullscreenPrompt() {
        document.getElementById('fullscreen-prompt').classList.remove('hidden');
    },

    hideFullscreenPrompt() {
        document.getElementById('fullscreen-prompt').classList.add('hidden');
        this.state.matchMode = 'casual';
        this.showDeitySelection(0);
    },
    
    closeWelcome() {
        document.getElementById('welcome-overlay').classList.add('hidden');
    },
    
    startWelcomeGame() {
        this.closeWelcome();
        this.state.matchMode = 'casual';
        this.showDeitySelection(0);
    },
    
    showQueueSelection() {
        const overlay = document.getElementById('queue-overlay');
        const tierInfo = Matchmaking.mmoToTier(Matchmaking.playerProfile.mmr);
        document.getElementById('player-rank-display').textContent = `${tierInfo.tier} ${tierInfo.level} (${Matchmaking.playerProfile.mmr} MMR)`;
        document.getElementById('player-stats-display').textContent = `W: ${Matchmaking.playerProfile.wins} / L: ${Matchmaking.playerProfile.losses}`;
        overlay.classList.remove('hidden');
    },
    
    hideQueueSelection() {
        document.getElementById('queue-overlay').classList.add('hidden');
    },
    
    joinQueue(mode) {
        this.state.matchMode = mode;
        this.hideQueueSelection();
        this.showFriendsScreen();
    },
    
    showFriendsScreen() {
        document.getElementById('friends-overlay').classList.remove('hidden');
        this.renderFriendsList();
    },
    
    hideFriendsScreen() {
        document.getElementById('friends-overlay').classList.add('hidden');
    },
    
    renderFriendsList() {
        const list = document.getElementById('friends-list');
        list.innerHTML = '';
        Matchmaking.friends.forEach(friend => {
            const status = Matchmaking.getFriendStatus(friend);
            const el = document.createElement('div');
            el.className = `friend-item ${status}`;
            el.innerHTML = `
                <div class="friend-info">
                    <span class="friend-name">${friend}</span>
                    <span class="friend-status">${status}</span>
                </div>
                <button class="challenge-btn" onclick="Game.startDirectChallenge('${friend}')">Challenge</button>
            `;
            list.appendChild(el);
        });
        
        const reqList = document.getElementById('friend-requests-list');
        reqList.innerHTML = '';
        Matchmaking.friendRequests.forEach(req => {
            const el = document.createElement('div');
            el.className = 'request-item';
            el.innerHTML = `
                <span>${req} wants to be friends</span>
                <button class="accept-btn" onclick="Game.acceptFriendRequest('${req}')">Accept</button>
                <button class="decline-btn" onclick="Game.declineFriendRequest('${req}')">Decline</button>
            `;
            reqList.appendChild(el);
        });
    },
    
    startDirectChallenge(friendName) {
        this.state.isPrivateMatch = true;
        this.state.challengeFriend = friendName;
        this.hideFriendsScreen();
        this.showDeitySelection(0);
    },
    
    addNewFriend() {
        const username = prompt('Enter friend username:');
        if (username && username.length > 0) {
            if (Matchmaking.addFriend(username)) {
                alert(`${username} added to friends!`);
                this.renderFriendsList();
            } else {
                alert('Friend already added or invalid username.');
            }
        }
    },
    
    acceptFriendRequest(username) {
        Matchmaking.acceptFriendRequest(username);
        alert(`${username} is now your friend!`);
        this.renderFriendsList();
    },
    
    declineFriendRequest(username) {
        Matchmaking.declineFriendRequest(username);
        this.renderFriendsList();
    },
    
    proceedToQueue() {
        this.hideFriendsScreen();
        this.showDeitySelection(0);
    },
    
    showReplayBrowser() {
        document.getElementById('replay-browser-overlay').classList.remove('hidden');
        this.renderReplayList();
    },
    
    hideReplayBrowser() {
        document.getElementById('replay-browser-overlay').classList.add('hidden');
    },
    
    renderReplayList() {
        const list = document.getElementById('replay-list');
        const replays = MatchRecorder.getAllReplays();
        
        if (replays.length === 0) {
            list.innerHTML = '<p class="no-replays">No replays saved yet. Play some matches!</p>';
            return;
        }
        
        list.innerHTML = replays.map(r => `
            <div class="replay-item" onclick="Game.loadReplay('${r.matchId}')">
                <div class="replay-matchup">
                    <span class="deity">${r.player1Deity}</span>
                    <span class="vs">vs</span>
                    <span class="deity">${r.player2Deity}</span>
                </div>
                <div class="replay-details">
                    <span class="turns">${r.turnCount} turns</span>
                    <span class="winner">P${r.winner + 1} wins</span>
                    <span class="date">${new Date(r.timestamp).toLocaleDateString()}</span>
                </div>
                <div class="replay-mode ${r.matchMode}">${r.matchMode.toUpperCase()}</div>
            </div>
        `).join('');
    },
    
    loadReplay(matchId) {
        this.hideReplayBrowser();
        ReplayViewer.loadReplay(matchId);
    },
    
    showSpectateBrowser() {
        document.getElementById('spectate-browser-overlay').classList.remove('hidden');
        this.renderLiveMatches();
    },
    
    hideSpectateBrowser() {
        document.getElementById('spectate-browser-overlay').classList.add('hidden');
    },
    
    renderLiveMatches() {
        const list = document.getElementById('live-matches-list');
        const matches = MatchRecorder.getLiveMatches();
        
        if (matches.length === 0) {
            list.innerHTML = '<p class="no-matches">No live matches available to spectate</p>';
            return;
        }
        
        list.innerHTML = matches.map(m => `
            <div class="live-match-item" onclick="Game.spectateMatch('${m.matchId}')">
                <span class="match-players">${m.player1Deity} vs ${m.player2Deity}</span>
                <span class="match-status">LIVE</span>
            </div>
        `).join('');
    },
    
    spectateMatch(matchId) {
        this.hideSpectateBrowser();
        SpectatorMode.startSpectating(matchId);
    },
    
    showAnalytics() {
        this.hideReplayBrowser();
        document.getElementById('analytics-overlay').classList.remove('hidden');
        this.switchAnalyticsTab('cards');
    },
    
    hideAnalytics() {
        document.getElementById('analytics-overlay').classList.add('hidden');
    },
    
    switchAnalyticsTab(tab) {
        document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.analytics-tab[data-tab="${tab}"]`)?.classList.add('active');
        
        const content = document.getElementById('analytics-content');
        
        if (tab === 'cards') {
            const topCards = Analytics.getTopCards(15);
            if (topCards.length === 0) {
                content.innerHTML = '<p class="no-data">Play more matches to generate card statistics</p>';
                return;
            }
            content.innerHTML = `
                <table class="analytics-table">
                    <thead><tr><th>Card</th><th>Type</th><th>Played</th><th>Winrate</th></tr></thead>
                    <tbody>
                        ${topCards.map(c => `
                            <tr>
                                <td>${c.name}</td>
                                <td>${c.type}</td>
                                <td>${c.played}</td>
                                <td class="winrate">${Math.round(c.winrate)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (tab === 'archetypes') {
            const archetypes = Analytics.getArchetypeStats();
            if (archetypes.length === 0) {
                content.innerHTML = '<p class="no-data">Play more matches to generate archetype data</p>';
                return;
            }
            content.innerHTML = `
                <table class="analytics-table">
                    <thead><tr><th>Archetype</th><th>Matches</th><th>Winrate</th></tr></thead>
                    <tbody>
                        ${archetypes.map(a => `
                            <tr>
                                <td>${a.name}</td>
                                <td>${a.total}</td>
                                <td class="winrate">${a.winrate}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (tab === 'history') {
            const history = Analytics.data.matchHistory.slice(-20).reverse();
            if (history.length === 0) {
                content.innerHTML = '<p class="no-data">No match history yet</p>';
                return;
            }
            content.innerHTML = `
                <table class="analytics-table">
                    <thead><tr><th>Match</th><th>Winner</th><th>Turns</th><th>Mode</th></tr></thead>
                    <tbody>
                        ${history.map(h => `
                            <tr>
                                <td>${h.player1Deity} vs ${h.player2Deity}</td>
                                <td>P${h.winner + 1}</td>
                                <td>${h.turnCount}</td>
                                <td>${h.matchMode}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    },
    
    exportAnalytics() {
        const data = Analytics.export();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'essence-crown-analytics.json';
        a.click();
        URL.revokeObjectURL(url);
    },
    
    showTournaments() {
        this.hideQueueSelection();
        document.getElementById('tournament-overlay').classList.remove('hidden');
        this.switchTournamentTab('open');
    },
    
    hideTournaments() {
        document.getElementById('tournament-overlay').classList.add('hidden');
        this.showQueueSelection();
    },
    
    switchTournamentTab(tab) {
        document.querySelectorAll('.tournament-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tournament-tab[data-tab="${tab}"]`)?.classList.add('active');
        
        const content = document.getElementById('tournament-content');
        
        if (tab === 'open') {
            const tournaments = TournamentManager.getOpenTournaments();
            if (tournaments.length === 0) {
                content.innerHTML = '<p class="no-tournaments">No open tournaments. Create one!</p>';
                return;
            }
            content.innerHTML = `<div class="tournament-list">${tournaments.map(t => this.renderTournamentItem(t)).join('')}</div>`;
        } else if (tab === 'active') {
            const tournaments = TournamentManager.getActiveTournaments();
            if (tournaments.length === 0) {
                content.innerHTML = '<p class="no-tournaments">No active tournaments</p>';
                return;
            }
            content.innerHTML = `<div class="tournament-list">${tournaments.map(t => this.renderTournamentItem(t)).join('')}</div>`;
        } else if (tab === 'completed') {
            const tournaments = TournamentManager.tournaments.filter(t => t.status === 'completed');
            if (tournaments.length === 0) {
                content.innerHTML = '<p class="no-tournaments">No completed tournaments</p>';
                return;
            }
            content.innerHTML = `<div class="tournament-list">${tournaments.map(t => this.renderTournamentItem(t)).join('')}</div>`;
        } else if (tab === 'create') {
            content.innerHTML = this.renderCreateTournamentForm();
        }
    },
    
    renderTournamentItem(t) {
        const eventName = t.eventId ? (EventManager.getEvent(t.eventId)?.name || 'Standard') : 'Standard';
        return `
            <div class="tournament-item" onclick="Game.viewTournament('${t.id}')">
                <div class="tournament-info">
                    <span class="tournament-name">${t.name}</span>
                    <div class="tournament-meta">
                        <span class="tournament-format ${t.format}">${t.format.toUpperCase()}</span>
                        <span class="tournament-players">${t.players.length}/${t.maxPlayers} players</span>
                        <span>${eventName}</span>
                    </div>
                </div>
                <span class="tournament-status ${t.status}">${t.status}</span>
            </div>
        `;
    },
    
    renderCreateTournamentForm() {
        const events = EventManager.getActiveEvents();
        return `
            <div class="create-tournament-form">
                <div class="form-group">
                    <label>Tournament Name</label>
                    <input type="text" id="create-tourney-name" placeholder="My Tournament" value="Shard Wars Championship">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Format</label>
                        <select id="create-tourney-format">
                            <option value="swiss">Swiss (Best for casual)</option>
                            <option value="elimination">Single Elimination</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Max Players</label>
                        <select id="create-tourney-players">
                            <option value="4">4 Players</option>
                            <option value="8" selected>8 Players</option>
                            <option value="16">16 Players</option>
                            <option value="32">32 Players</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Event / Format Rules</label>
                    <select id="create-tourney-event">
                        <option value="">Standard (No Restrictions)</option>
                        ${events.map(e => `<option value="${e.id}">${e.icon} ${e.name}</option>`).join('')}
                    </select>
                </div>
                <button class="create-btn" onclick="Game.createTournament()">CREATE TOURNAMENT</button>
            </div>
        `;
    },
    
    createTournament() {
        const name = document.getElementById('create-tourney-name').value || 'Shard Wars Tournament';
        const format = document.getElementById('create-tourney-format').value;
        const maxPlayers = parseInt(document.getElementById('create-tourney-players').value);
        const eventId = document.getElementById('create-tourney-event').value || null;
        
        const tournament = TournamentManager.createTournament({
            name, format, maxPlayers, eventId
        });
        
        this.log(`Created tournament: ${name}`, 'action');
        this.viewTournament(tournament.id);
    },
    
    viewTournament(tournamentId) {
        TournamentManager.setActiveTournament(tournamentId);
        const t = TournamentManager.activeTournament;
        if (!t) return;
        
        document.getElementById('tournament-overlay').classList.add('hidden');
        document.getElementById('tournament-detail-overlay').classList.remove('hidden');
        
        document.getElementById('tournament-detail-name').textContent = t.name;
        document.getElementById('tournament-detail-status').textContent = t.status;
        document.getElementById('tournament-detail-status').className = `tournament-status ${t.status}`;
        document.getElementById('tournament-detail-format').textContent = t.format.toUpperCase();
        document.getElementById('tournament-detail-players').textContent = `${t.players.length}/${t.maxPlayers}`;
        document.getElementById('tournament-detail-round').textContent = `${t.currentRound}/${t.maxRounds}`;
        
        const eventRow = document.getElementById('tournament-event-row');
        if (t.eventId) {
            const event = EventManager.getEvent(t.eventId);
            document.getElementById('tournament-detail-event').textContent = event ? `${event.icon} ${event.name}` : 'Standard';
            eventRow.style.display = 'flex';
        } else {
            eventRow.style.display = 'none';
        }
        
        this.updateTournamentActions(t);
        this.switchTournamentDetailTab('matches');
    },
    
    updateTournamentActions(t) {
        const actions = document.getElementById('tournament-actions');
        const playerId = Matchmaking.playerProfile.playerId;
        const isRegistered = t.players.find(p => p.playerId === playerId);
        
        let html = '';
        
        if (t.status === 'registration') {
            if (isRegistered) {
                html = `<button class="action-btn danger" onclick="Game.unregisterFromTournament()">Leave Tournament</button>`;
            } else if (t.players.length < t.maxPlayers) {
                html = `<button class="action-btn primary" onclick="Game.registerForTournament()">Join Tournament</button>`;
            }
            if (t.players.length >= 2) {
                html += `<button class="action-btn secondary" onclick="Game.startTournament()">Start Tournament</button>`;
            }
        } else if (t.status === 'active') {
            const myMatch = TournamentManager.getPlayerMatch(t.id, playerId);
            if (myMatch) {
                html = `<button class="action-btn primary" onclick="Game.playTournamentMatch('${myMatch.matchId}')">Play Match</button>`;
            }
        }
        
        actions.innerHTML = html;
    },
    
    registerForTournament() {
        const t = TournamentManager.activeTournament;
        if (!t) return;
        
        const result = TournamentManager.registerPlayer(t.id, Matchmaking.playerProfile);
        if (result.success) {
            this.log(`Registered for ${t.name}`, 'action');
            this.viewTournament(t.id);
        } else {
            this.log(result.error, 'damage');
        }
    },
    
    unregisterFromTournament() {
        const t = TournamentManager.activeTournament;
        if (!t) return;
        
        const result = TournamentManager.unregisterPlayer(t.id, Matchmaking.playerProfile.playerId);
        if (result.success) {
            this.log(`Left tournament`, 'action');
            this.viewTournament(t.id);
        }
    },
    
    startTournament() {
        const t = TournamentManager.activeTournament;
        if (!t) return;
        
        const result = TournamentManager.startTournament(t.id);
        if (result.success) {
            this.log(`Tournament started!`, 'phase');
            this.viewTournament(t.id);
        } else {
            this.log(result.error, 'damage');
        }
    },
    
    playTournamentMatch(matchId) {
        const t = TournamentManager.activeTournament;
        if (!t) return;
        
        TournamentManager.currentMatch = matchId;
        this.state.matchMode = 'tournament';
        this.state.tournamentId = t.id;
        this.state.tournamentMatchId = matchId;
        
        if (t.eventId) {
            EventManager.setActiveEvent(t.eventId);
        }
        
        document.getElementById('tournament-detail-overlay').classList.add('hidden');
        this.showDeitySelection(0);
    },
    
    reportTournamentResult(winnerId) {
        const t = TournamentManager.activeTournament;
        if (!t || !this.state.tournamentMatchId) return;
        
        const result = TournamentManager.reportMatchResult(t.id, this.state.tournamentMatchId, winnerId, '2-0');
        
        this.state.tournamentMatchId = null;
        TournamentManager.currentMatch = null;
        EventManager.clearActiveEvent();
    },
    
    switchTournamentDetailTab(tab) {
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.detail-tab[data-tab="${tab}"]`)?.classList.add('active');
        
        const content = document.getElementById('tournament-detail-content');
        const t = TournamentManager.activeTournament;
        if (!t) return;
        
        if (tab === 'matches') {
            const matches = TournamentManager.getCurrentMatches(t.id);
            if (matches.length === 0) {
                content.innerHTML = '<p class="no-tournaments">No matches in current round</p>';
                return;
            }
            content.innerHTML = `
                <div class="matches-list">
                    ${matches.map(m => `
                        <div class="match-item">
                            <div class="match-players">
                                <span class="match-player ${m.winner === m.player1 ? 'winner' : ''}">${m.player1Name}</span>
                                <span class="match-vs">VS</span>
                                <span class="match-player ${m.winner === m.player2 ? 'winner' : ''}">${m.player2Name}</span>
                            </div>
                            <span class="match-result ${m.reported ? 'completed' : 'pending'}">
                                ${m.reported ? (m.result || 'Completed') : 'Pending'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (tab === 'standings') {
            const standings = TournamentManager.getStandings(t.id);
            content.innerHTML = `
                <table class="standings-table">
                    <thead><tr><th>#</th><th>Player</th><th>W-L</th><th>Points</th><th>OWR</th></tr></thead>
                    <tbody>
                        ${standings.map((p, i) => `
                            <tr>
                                <td class="rank">${i + 1}</td>
                                <td>${p.username}</td>
                                <td>${p.wins}-${p.losses}</td>
                                <td>${p.matchPoints}</td>
                                <td>${Math.round(p.opponentWinRate * 100)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (tab === 'bracket') {
            if (t.format !== 'elimination') {
                content.innerHTML = '<p class="no-tournaments">Bracket view only for elimination tournaments</p>';
                return;
            }
            content.innerHTML = this.renderBracket(t);
        }
    },
    
    renderBracket(t) {
        if (t.rounds.length === 0) return '<p class="no-tournaments">Tournament not started</p>';
        
        const roundNames = ['Round 1', 'Quarterfinals', 'Semifinals', 'Finals'];
        
        return `
            <div class="bracket-container">
                ${t.rounds.map((round, idx) => `
                    <div class="bracket-round">
                        <div class="bracket-round-title">${roundNames[idx] || `Round ${idx + 1}`}</div>
                        ${round.matches.map(m => `
                            <div class="bracket-match">
                                <div class="bracket-player ${m.winner === m.player1 ? 'winner' : ''}">
                                    <span>${m.player1Name}</span>
                                    <span class="score">${m.winner === m.player1 ? 'W' : ''}</span>
                                </div>
                                <div class="bracket-player ${m.winner === m.player2 ? 'winner' : ''}">
                                    <span>${m.player2Name}</span>
                                    <span class="score">${m.winner === m.player2 ? 'W' : ''}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    backToTournaments() {
        document.getElementById('tournament-detail-overlay').classList.add('hidden');
        document.getElementById('tournament-overlay').classList.remove('hidden');
        this.switchTournamentTab('open');
    },
    
    showEvents() {
        this.hideQueueSelection();
        document.getElementById('events-overlay').classList.remove('hidden');
        this.renderEvents();
    },
    
    hideEvents() {
        document.getElementById('events-overlay').classList.add('hidden');
        this.showQueueSelection();
    },
    
    renderEvents() {
        const events = EventManager.getActiveEvents();
        const list = document.getElementById('events-list');
        
        if (events.length === 0) {
            list.innerHTML = '<p class="no-tournaments">No special events available</p>';
            return;
        }
        
        list.innerHTML = events.map(e => `
            <div class="event-card" onclick="Game.selectEvent('${e.id}')">
                <div class="event-card-header">
                    <span class="event-icon">${e.icon}</span>
                    <h3>${e.name}</h3>
                </div>
                <p class="event-card-description">${e.description}</p>
                <div class="event-card-meta">
                    ${e.rules.allowedAspects.map(a => `<span class="event-tag aspect-${a.toLowerCase()}">${a}</span>`).join('')}
                    ${e.rules.bannedTypes.map(t => `<span class="event-tag">No ${t}s</span>`).join('')}
                    <span class="event-tag">${e.format.toUpperCase()}</span>
                </div>
            </div>
        `).join('');
    },
    
    selectedEventId: null,
    
    selectEvent(eventId) {
        const event = EventManager.getEvent(eventId);
        if (!event) return;
        
        this.selectedEventId = eventId;
        
        document.getElementById('events-overlay').classList.add('hidden');
        document.getElementById('event-queue-overlay').classList.remove('hidden');
        
        document.querySelector('#event-queue-header .event-icon').textContent = event.icon;
        document.getElementById('event-queue-name').textContent = event.name;
        
        const rulesDiv = document.getElementById('event-queue-rules');
        rulesDiv.innerHTML = `
            <div class="event-rule">
                <span class="rule-label">Allowed Aspects</span>
                <span class="rule-value">${event.rules.allowedAspects.join(', ') || 'All'}</span>
            </div>
            ${event.rules.bannedTypes.length > 0 ? `
                <div class="event-rule">
                    <span class="rule-label">Banned Types</span>
                    <span class="rule-value">${event.rules.bannedTypes.join(', ')}</span>
                </div>
            ` : ''}
            <div class="event-rule">
                <span class="rule-label">Starting Essence</span>
                <span class="rule-value">${event.rules.startingEssence}</span>
            </div>
            <div class="event-rule">
                <span class="rule-label">Starting KL</span>
                <span class="rule-value">${event.rules.startingKL}</span>
            </div>
            <div class="event-rule">
                <span class="rule-label">Format</span>
                <span class="rule-value">${event.format.toUpperCase()}</span>
            </div>
        `;
    },
    
    hideEventQueue() {
        document.getElementById('event-queue-overlay').classList.add('hidden');
        this.showEvents();
    },
    
    joinEventQueue() {
        if (!this.selectedEventId) return;
        
        EventManager.setActiveEvent(this.selectedEventId);
        this.state.matchMode = 'event';
        this.state.eventId = this.selectedEventId;
        
        document.getElementById('event-queue-overlay').classList.add('hidden');
        this.showDeitySelection(0);
    },

    showLimited() {
        this.hideQueueSelection();
        LimitedMode.init();
        
        if (LimitedMode.sealedActive) {
            this.showSealedDeckbuilder();
        } else {
            document.getElementById('limited-overlay').classList.remove('hidden');
        }
    },
    
    hideLimited() {
        document.getElementById('limited-overlay').classList.add('hidden');
        this.showQueueSelection();
    },
    
    startSealed() {
        LimitedMode.generateSealedPool();
        document.getElementById('limited-overlay').classList.add('hidden');
        this.showSealedDeckbuilder();
    },
    
    showSealedDeckbuilder() {
        document.getElementById('sealed-deckbuilder-overlay').classList.remove('hidden');
        this.renderSealedDeckbuilder();
    },
    
    renderSealedDeckbuilder() {
        const pool = LimitedMode.currentPool;
        const deck = LimitedMode.currentDeck;
        
        document.getElementById('sealed-deck-count').textContent = `Deck: ${deck.length}/${LimitedMode.sealedConfig.minDeckSize}-${LimitedMode.sealedConfig.maxDeckSize}`;
        document.getElementById('sealed-pool-count').textContent = `Pool: ${pool.length}`;
        
        const poolGrid = document.getElementById('sealed-pool');
        poolGrid.innerHTML = pool.map(card => `
            <div class="sealed-card" onclick="Game.addCardToDeck('${card.instanceId}')" 
                 style="background-image: url('${card.image || CARD_BACK_URL}')"
                 title="${card.name} - ${card.rarity}">
                <div class="rarity-indicator ${card.rarity}"></div>
            </div>
        `).join('');
        
        const deckGrid = document.getElementById('sealed-deck');
        deckGrid.innerHTML = deck.map(card => `
            <div class="sealed-card" onclick="Game.removeCardFromDeck('${card.instanceId}')"
                 style="background-image: url('${card.image || CARD_BACK_URL}')"
                 title="${card.name} - ${card.rarity}">
                <div class="rarity-indicator ${card.rarity}"></div>
            </div>
        `).join('');
        
        const playBtn = document.getElementById('sealed-play-btn');
        playBtn.disabled = !LimitedMode.isDeckValid();
    },
    
    addCardToDeck(cardInstanceId) {
        const result = LimitedMode.addToDeck(cardInstanceId);
        if (result.success) {
            this.renderSealedDeckbuilder();
        }
    },
    
    removeCardFromDeck(cardInstanceId) {
        const result = LimitedMode.removeFromDeck(cardInstanceId);
        if (result.success) {
            this.renderSealedDeckbuilder();
        }
    },
    
    exitSealed() {
        if (confirm('Abandon your sealed pool? This cannot be undone.')) {
            LimitedMode.endSealed();
            document.getElementById('sealed-deckbuilder-overlay').classList.add('hidden');
            this.showQueueSelection();
        }
    },
    
    playSealedDeck() {
        if (!LimitedMode.isDeckValid()) return;
        
        this.state.matchMode = 'sealed';
        this.state.sealedDeck = LimitedMode.getDeckForGame();
        
        document.getElementById('sealed-deckbuilder-overlay').classList.add('hidden');
        this.showDeitySelection(0);
    },
    
    showCosmetics() {
        this.hideQueueSelection();
        CosmeticsManager.init();
        document.getElementById('cosmetics-overlay').classList.remove('hidden');
        document.getElementById('cosmetics-currency').textContent = ShardPath.getCurrency();
        this.showCosmeticType('cardBack');
    },
    
    hideCosmetics() {
        document.getElementById('cosmetics-overlay').classList.add('hidden');
        this.showQueueSelection();
    },
    
    showCosmeticType(type) {
        document.querySelectorAll('.cosmetic-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.type === type);
        });
        
        const cosmetics = CosmeticsManager.getCosmeticsByType(type);
        const grid = document.getElementById('cosmetics-grid');
        
        grid.innerHTML = cosmetics.map(c => {
            const owned = CosmeticsManager.isOwned(c.id);
            const equipped = CosmeticsManager.getEquipped(type, c.deityId) === c.id;
            
            return `
                <div class="cosmetic-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}">
                    <div class="cosmetic-preview">${this.getCosmeticPreviewIcon(c)}</div>
                    <h3>${c.name}</h3>
                    <div class="cosmetic-rarity ${c.rarity}">${c.rarity}</div>
                    ${!owned ? `
                        <div class="cosmetic-price">
                            <span class="shard-icon">💎</span>
                            <span>${c.price}</span>
                        </div>
                        <button class="cosmetic-btn purchase" onclick="Game.purchaseCosmetic('${c.id}')">Purchase</button>
                    ` : equipped ? `
                        <button class="cosmetic-btn equipped">Equipped</button>
                    ` : `
                        <button class="cosmetic-btn equip" onclick="Game.equipCosmetic('${c.id}')">Equip</button>
                    `}
                </div>
            `;
        }).join('');
    },
    
    getCosmeticPreviewIcon(cosmetic) {
        const icons = {
            cardBack: '🎴',
            boardSkin: '🌍',
            cardFrame: '🖼️',
            effectVariant: '✨',
            deitySkin: '👑'
        };
        return icons[cosmetic.type] || '🎁';
    },
    
    purchaseCosmetic(id) {
        const result = CosmeticsManager.purchase(id);
        if (result.success) {
            document.getElementById('cosmetics-currency').textContent = ShardPath.getCurrency();
            const cosmetic = CosmeticsManager.getCosmetic(id);
            this.showCosmeticType(cosmetic.type);
        } else {
            alert(result.error);
        }
    },
    
    equipCosmetic(id) {
        const result = CosmeticsManager.equip(id);
        if (result.success) {
            const cosmetic = CosmeticsManager.getCosmetic(id);
            this.showCosmeticType(cosmetic.type);
        }
    },
    
    showShardPath() {
        this.hideQueueSelection();
        ShardPath.init();
        document.getElementById('shard-path-overlay').classList.remove('hidden');
        this.renderShardPath();
    },
    
    hideShardPath() {
        document.getElementById('shard-path-overlay').classList.add('hidden');
        this.showQueueSelection();
    },
    
    renderShardPath() {
        const progress = ShardPath.getProgress();
        
        document.getElementById('shard-path-season').textContent = progress.seasonName.toUpperCase();
        
        const daysRemaining = Math.ceil((progress.seasonEnd - Date.now()) / (24 * 60 * 60 * 1000));
        document.getElementById('shard-path-timer').textContent = `${Math.max(0, daysRemaining)} days remaining`;
        
        document.getElementById('shard-path-level').textContent = `Level ${progress.level}`;
        document.getElementById('shard-path-xp-fill').style.width = `${progress.percentage}%`;
        document.getElementById('shard-path-xp').textContent = `${progress.xp} / ${progress.xpRequired} XP`;
        document.getElementById('shard-path-currency').textContent = progress.currency;
        
        document.getElementById('premium-status').textContent = progress.premiumUnlocked ? '✓' : '🔒';
        document.getElementById('premium-status').className = progress.premiumUnlocked ? 'unlocked' : 'locked';
        
        this.renderRewardTracks();
        this.renderQuests();
    },
    
    renderRewardTracks() {
        const progress = ShardPath.getProgress();
        
        const freeTrack = document.getElementById('free-track-rewards');
        freeTrack.innerHTML = ShardPath.rewards.free.map(r => this.renderRewardNode(r, false, progress.level)).join('');
        
        const premiumTrack = document.getElementById('premium-track-rewards');
        premiumTrack.innerHTML = ShardPath.rewards.premium.map(r => this.renderRewardNode(r, true, progress.level)).join('');
    },
    
    renderRewardNode(reward, isPremium, currentLevel) {
        const unlocked = currentLevel >= reward.level;
        const claimed = ShardPath.isRewardClaimed(reward.level, isPremium);
        const canClaim = unlocked && !claimed && (isPremium ? ShardPath.data.premiumUnlocked : true);
        
        const icon = reward.type === 'currency' ? '💎' : '🎁';
        
        return `
            <div class="reward-node ${unlocked ? 'unlocked' : 'locked'} ${claimed ? 'claimed' : ''}">
                <div class="reward-level">Level ${reward.level}</div>
                <div class="reward-icon">${icon}</div>
                <div class="reward-name">${reward.name}</div>
                <button class="reward-claim-btn ${canClaim ? 'claim' : claimed ? 'claimed' : 'locked'}"
                        onclick="${canClaim ? `Game.claimPathReward(${reward.level}, ${isPremium})` : ''}"
                        ${!canClaim ? 'disabled' : ''}>
                    ${claimed ? 'Claimed' : canClaim ? 'Claim' : 'Locked'}
                </button>
            </div>
        `;
    },
    
    renderQuests() {
        const dailyContainer = document.getElementById('daily-quests');
        dailyContainer.innerHTML = ShardPath.data.dailyQuests.map(q => this.renderQuestItem(q, false)).join('');
        
        const weeklyContainer = document.getElementById('weekly-quests');
        weeklyContainer.innerHTML = ShardPath.data.weeklyQuests.map(q => this.renderQuestItem(q, true)).join('');
    },
    
    renderQuestItem(quest, isWeekly) {
        const progressPercent = Math.min(100, (quest.progress / quest.target) * 100);
        
        return `
            <div class="quest-item ${quest.completed ? 'completed' : ''} ${quest.claimed ? 'claimed' : ''}">
                <div class="quest-info">
                    <h4>${quest.name}</h4>
                    <p>${quest.description}</p>
                </div>
                <div class="quest-progress">
                    <div class="quest-progress-bar">
                        <div class="quest-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <span class="quest-progress-text">${quest.progress}/${quest.target}</span>
                </div>
                <div class="quest-reward">
                    <span>+${quest.xp} XP</span>
                </div>
                <button class="quest-claim-btn ${quest.completed && !quest.claimed ? 'claim' : ''}"
                        onclick="Game.claimQuestReward('${quest.id}', ${isWeekly})"
                        ${!quest.completed || quest.claimed ? 'disabled' : ''}>
                    ${quest.claimed ? 'Claimed' : quest.completed ? 'Claim' : 'In Progress'}
                </button>
            </div>
        `;
    },
    
    showShardPathTab(tab) {
        document.querySelectorAll('.path-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        document.getElementById('shard-path-content').classList.toggle('hidden', tab !== 'rewards');
        document.getElementById('shard-path-quests').classList.toggle('hidden', tab !== 'quests');
    },
    
    claimPathReward(level, isPremium) {
        const result = ShardPath.claimReward(level, isPremium);
        if (result.success) {
            this.renderShardPath();
        }
    },
    
    claimQuestReward(questId, isWeekly) {
        const result = ShardPath.claimQuestReward(questId, isWeekly);
        if (result.success) {
            this.renderShardPath();
        }
    },
    
    showSandbox() {
        document.getElementById('queue-overlay').classList.add('hidden');
        document.getElementById('sandbox-overlay').classList.remove('hidden');
        
        this.state.selectedDeities = [getDeities()[0], getDeities()[1]];
        this.startGame();
        SandboxMode.enter();
        
        this.renderSandboxSavedStates();
        this.searchSandboxCards('');
    },
    
    hideSandbox() {
        document.getElementById('sandbox-overlay').classList.add('hidden');
        SandboxMode.exit();
        this.proceedToQueue();
    },
    
    searchSandboxCards(query) {
        const container = document.getElementById('sandbox-card-results');
        if (!container) return;
        
        const q = query.toLowerCase();
        const cards = ALL_CARDS
            .filter(c => c.type !== 'Deity')
            .filter(c => !q || c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q))
            .slice(0, 30);
        
        container.innerHTML = cards.map(c => `
            <div class="sandbox-card-item" onclick="Game.addSandboxCard('${c.id}')">
                <div class="card-name">${c.name}</div>
                <div class="card-type">${c.type} - ${c.aspect || 'Neutral'}</div>
            </div>
        `).join('');
    },
    
    addSandboxCard(cardId) {
        const playerIndex = parseInt(document.getElementById('sandbox-player-select').value);
        const zone = document.getElementById('sandbox-zone-select').value;
        SandboxMode.addCardToZone(playerIndex, cardId, zone);
    },
    
    sandboxApplyPlayer(playerIndex) {
        const prefix = playerIndex === 0 ? 'p1' : 'p2';
        const essence = document.getElementById(`sandbox-${prefix}-essence`).value;
        const kl = document.getElementById(`sandbox-${prefix}-kl`).value;
        const klMax = document.getElementById(`sandbox-${prefix}-kl-max`).value;
        
        SandboxMode.setEssence(playerIndex, essence);
        SandboxMode.setKL(playerIndex, kl, klMax);
    },
    
    sandboxSaveState() {
        const name = document.getElementById('sandbox-state-name').value || `State ${Date.now()}`;
        SandboxMode.saveState(name);
        document.getElementById('sandbox-state-name').value = '';
        this.renderSandboxSavedStates();
    },
    
    renderSandboxSavedStates() {
        const container = document.getElementById('sandbox-saved-states');
        if (!container) return;
        
        container.innerHTML = SandboxMode.savedStates.map((state, idx) => `
            <div class="sandbox-state-item">
                <div>
                    <span class="state-name">${state.name}</span>
                    <span class="state-date">${new Date(state.timestamp).toLocaleDateString()}</span>
                </div>
                <button class="sandbox-btn" onclick="Game.loadSandboxState(${idx})">Load</button>
            </div>
        `).join('') || '<p style="color:rgba(255,255,255,0.5);text-align:center;">No saved states</p>';
    },
    
    loadSandboxState(index) {
        SandboxMode.loadState(index);
    },
    
    sandboxStartGame() {
        document.getElementById('sandbox-overlay').classList.add('hidden');
        SandboxMode.startGame();
    },
    
    showCustomLobby() {
        document.getElementById('queue-overlay').classList.add('hidden');
        document.getElementById('custom-lobby-overlay').classList.remove('hidden');
        this.showLobbyTab('create');
        this.refreshLobbies();
    },
    
    hideCustomLobby() {
        document.getElementById('custom-lobby-overlay').classList.add('hidden');
        this.proceedToQueue();
    },
    
    showLobbyTab(tab) {
        document.querySelectorAll('.lobby-tab').forEach(t => {
            t.classList.toggle('active', t.textContent.toLowerCase().includes(tab));
        });
        
        document.getElementById('lobby-create-tab').classList.toggle('hidden', tab !== 'create');
        document.getElementById('lobby-browse-tab').classList.toggle('hidden', tab !== 'browse');
    },
    
    applyLobbyPreset() {
        const preset = document.getElementById('lobby-preset').value;
        if (!preset) return;
        
        const p = CustomLobby.presets[preset];
        if (!p) return;
        
        document.getElementById('lobby-name').value = p.name;
        document.getElementById('lobby-essence').value = p.essence;
        document.getElementById('lobby-kl').value = p.kl;
        document.getElementById('lobby-victory').value = p.victory;
        
        if (p.victory === 'avatars') {
            document.getElementById('lobby-avatar-count-row').style.display = 'flex';
            document.getElementById('lobby-avatar-count').value = p.avatarWinCount || 5;
        } else {
            document.getElementById('lobby-avatar-count-row').style.display = 'none';
        }
        
        document.getElementById('lobby-aspect-glow').checked = !p.aspects || p.aspects.includes('Glow');
        document.getElementById('lobby-aspect-void').checked = !p.aspects || p.aspects.includes('Void');
        document.getElementById('lobby-aspect-gray').checked = !p.aspects || p.aspects.includes('Gray');
        
        document.getElementById('lobby-type-avatar').checked = !p.types || p.types.includes('Avatar');
        document.getElementById('lobby-type-spell').checked = !p.types || p.types.includes('Spell');
        document.getElementById('lobby-type-domain').checked = !p.types || p.types.includes('Domain');
        document.getElementById('lobby-type-relic').checked = !p.types || p.types.includes('Relic');
    },
    
    createCustomLobby() {
        const aspects = [];
        if (document.getElementById('lobby-aspect-glow').checked) aspects.push('Glow');
        if (document.getElementById('lobby-aspect-void').checked) aspects.push('Void');
        if (document.getElementById('lobby-aspect-gray').checked) aspects.push('Gray');
        
        const types = [];
        if (document.getElementById('lobby-type-avatar').checked) types.push('Avatar');
        if (document.getElementById('lobby-type-spell').checked) types.push('Spell');
        if (document.getElementById('lobby-type-domain').checked) types.push('Domain');
        if (document.getElementById('lobby-type-relic').checked) types.push('Relic');
        
        const settings = {
            name: document.getElementById('lobby-name').value || 'Custom Match',
            essence: parseInt(document.getElementById('lobby-essence').value) || 23,
            kl: parseInt(document.getElementById('lobby-kl').value) || 3,
            aspects: aspects.length === 3 ? null : aspects,
            types: types.length === 4 ? null : types,
            victory: document.getElementById('lobby-victory').value,
            avatarWinCount: parseInt(document.getElementById('lobby-avatar-count').value) || 5,
            preset: document.getElementById('lobby-preset').value || null
        };
        
        const playerName = this.state.playerName || 'Player';
        const lobby = CustomLobby.create(playerName, settings);
        
        document.getElementById('custom-lobby-overlay').classList.add('hidden');
        this.showLobbyWaiting(lobby);
    },
    
    showLobbyWaiting(lobby) {
        document.getElementById('lobby-waiting-overlay').classList.remove('hidden');
        document.getElementById('lobby-waiting-name').textContent = lobby.settings.name;
        
        const summary = document.getElementById('lobby-rules-summary');
        summary.innerHTML = `
            <p><strong>Essence:</strong> ${lobby.settings.startingEssence}</p>
            <p><strong>Starting KL:</strong> ${lobby.settings.startingKL}</p>
            <p><strong>Victory:</strong> ${lobby.settings.victoryCondition === 'avatars' 
                ? `Destroy ${lobby.settings.avatarWinCount} Avatars` 
                : 'Reduce Essence to 0'}</p>
            ${lobby.settings.allowedAspects 
                ? `<p><strong>Aspects:</strong> ${lobby.settings.allowedAspects.join(', ')}</p>` 
                : ''}
            ${lobby.settings.allowedTypes 
                ? `<p><strong>Types:</strong> ${lobby.settings.allowedTypes.join(', ')}</p>` 
                : ''}
        `;
        
        this.renderLobbyPlayers(lobby);
        this.simulateLobbyJoin(lobby);
    },
    
    renderLobbyPlayers(lobby) {
        const container = document.getElementById('lobby-player-list');
        container.innerHTML = lobby.players.map((p, i) => `
            <div class="lobby-player-item ${i === 0 ? 'host' : ''}">${p}</div>
        `).join('');
        
        const startBtn = document.getElementById('lobby-start-btn');
        if (lobby.players.length >= 2) {
            startBtn.disabled = false;
            startBtn.textContent = 'START MATCH';
        } else {
            startBtn.disabled = true;
            startBtn.textContent = 'Waiting for opponent...';
        }
    },
    
    simulateLobbyJoin(lobby) {
        setTimeout(() => {
            if (CustomLobby.currentLobby?.id === lobby.id && lobby.players.length < 2) {
                lobby.players.push('Opponent');
                this.renderLobbyPlayers(lobby);
            }
        }, 2000);
    },
    
    leaveCustomLobby() {
        if (CustomLobby.currentLobby) {
            CustomLobby.leave(CustomLobby.currentLobby.id, this.state.playerName || 'Player');
        }
        document.getElementById('lobby-waiting-overlay').classList.add('hidden');
        this.proceedToQueue();
    },
    
    startCustomLobby() {
        const lobby = CustomLobby.currentLobby;
        if (!lobby || lobby.players.length < 2) return;
        
        CustomLobby.start(lobby.id);
        
        this.state.matchMode = 'custom';
        this.state.customLobbySettings = lobby.settings;
        
        document.getElementById('lobby-waiting-overlay').classList.add('hidden');
        this.showDeitySelection(0);
    },
    
    refreshLobbies() {
        const container = document.getElementById('lobby-list');
        const lobbies = CustomLobby.getOpenLobbies();
        
        if (lobbies.length === 0) {
            container.innerHTML = '<p class="lobby-empty">No open lobbies available. Create one!</p>';
            return;
        }
        
        container.innerHTML = lobbies.map(lobby => `
            <div class="lobby-item">
                <div class="lobby-item-info">
                    <h4>${lobby.settings.name}</h4>
                    <p>Host: ${lobby.host} | ${lobby.players.length}/${lobby.maxPlayers} players | ${lobby.settings.startingEssence} Essence</p>
                </div>
                <button class="lobby-item-join" onclick="Game.joinLobby('${lobby.id}')">Join</button>
            </div>
        `).join('');
    },
    
    joinLobby(lobbyId) {
        const playerName = this.state.playerName || 'Player';
        const result = CustomLobby.join(lobbyId, playerName);
        
        if (result.success) {
            document.getElementById('custom-lobby-overlay').classList.add('hidden');
            this.showLobbyWaiting(result.lobby);
        } else {
            this.showPrompt(result.error);
        }
    },

    requestFullscreen() {
        const elem = document.documentElement;
        const goToGame = () => {
            document.getElementById('fullscreen-prompt').classList.add('hidden');
            this.state.matchMode = 'casual';
            this.showDeitySelection(0);
        };
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(goToGame).catch(goToGame);
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
            goToGame();
        } else {
            goToGame();
        }
    },

    enterCombatMode() {
        if (this.state.currentPhase !== 'clash') {
            this.showPrompt('Attacks can only be declared during Clash phase!');
            return;
        }
        this.state.combat.mode = 'selectAttacker';
        this.showPrompt('Select an Avatar to attack with');
        this.render();
    },

    exitCombatMode() {
        this.state.combat.mode = null;
        this.state.combat.selectedAttacker = null;
        this.state.combat.selectedTarget = null;
        this.state.combat.declaredAttackers = [];
        this.state.combat.declaredBlockers = {};
        this.state.combat.pendingCombatResolution = false;
        this.hidePrompt();
        this.hideBattleOverlay();
        this.hideBlockerOverlay();
        this.render();
    },
    
    // ==================== ENHANCED COMBAT: BLOCKER DECLARATION ====================
    
    /**
     * Toggle an attacker for batch attack declaration
     * Allows selecting multiple attackers before committing
     */
    toggleAttacker(card, playerIndex) {
        if (playerIndex !== this.state.currentPlayer) {
            this.showPrompt('You can only attack with your own Avatars!');
            return;
        }
        
        const existingIndex = this.state.combat.declaredAttackers.findIndex(
            a => a.card.instanceId === card.instanceId
        );
        
        if (existingIndex !== -1) {
            // Deselect attacker
            this.state.combat.declaredAttackers.splice(existingIndex, 1);
            this.log(`${card.name} will not attack`, 'action');
        } else {
            // Validate attacker can attack
            if (card.tapped) {
                this.showPrompt('This Avatar is tapped and cannot attack!');
                return;
            }
            if (this.state.combat.attackedThisTurn.includes(card.instanceId)) {
                this.showPrompt('This Avatar has already attacked this turn!');
                return;
            }
            if (this.hasSummoningSickness(card)) {
                this.showPrompt('This Avatar has summoning sickness!');
                return;
            }
            
            // Add to declared attackers (defaulting to deity target)
            this.state.combat.declaredAttackers.push({
                card: card,
                targetType: 'deity',
                targetCard: null
            });
            this.log(`${card.name} declared as attacker`, 'action');
        }
        
        this.render();
        this.highlightDeclaredAttackers();
    },
    
    /**
     * Highlight cards that are declared as attackers
     */
    highlightDeclaredAttackers() {
        document.querySelectorAll('.game-card').forEach(el => {
            el.classList.remove('declared-attacker');
        });
        
        this.state.combat.declaredAttackers.forEach(({ card }) => {
            const cardEl = document.querySelector(`[data-instance-id="${card.instanceId}"]`);
            if (cardEl) {
                cardEl.classList.add('declared-attacker');
            }
        });
    },
    
    /**
     * Confirm all declared attackers and move to blocker phase
     * Called when player clicks "Attack!" after selecting attackers
     */
    confirmAttackers() {
        const attackers = this.state.combat.declaredAttackers;
        
        if (attackers.length === 0) {
            this.showPrompt('Select at least one Avatar to attack with!');
            return;
        }
        
        this.log(`Declared ${attackers.length} attackers`, 'phase');
        
        // Check if opponent has any valid blockers
        const defenderIndex = 1 - this.state.currentPlayer;
        const validBlockers = this.getValidBlockers(defenderIndex);
        
        if (validBlockers.length === 0 || defenderIndex === 1) {
            // No blockers OR AI defender - skip to combat resolution
            // AI will auto-block, then we resolve
            if (defenderIndex === 1) {
                this.aiDeclareBlockers();
            }
            this.showBlockerSummaryAndResolve();
        } else {
            // Human defender - show blocker selection
            this.state.combat.mode = 'declareBlockers';
            this.showBlockerSelectionUI();
        }
    },
    
    /**
     * AI automatically declares blockers based on strategy
     */
    aiDeclareBlockers() {
        const aiIndex = 1;
        const validBlockers = this.getValidBlockers(aiIndex);
        const attackers = this.state.combat.declaredAttackers;
        
        if (validBlockers.length === 0 || attackers.length === 0) {
            return;
        }
        
        // Sort blockers by health (prefer blocking with high-health units)
        const sortedBlockers = [...validBlockers].sort((a, b) => 
            (b.health || 0) - (a.health || 0)
        );
        
        // Sort attackers by attack power (block strongest first)
        const sortedAttackers = [...attackers].sort((a, b) => 
            (b.card.attack || 0) - (a.card.attack || 0)
        );
        
        // AI blocking strategy: block strongest attackers with best blockers
        const usedBlockers = new Set();
        
        for (const attackerData of sortedAttackers) {
            const attacker = attackerData.card;
            
            // Find best available blocker
            const blocker = sortedBlockers.find(b => 
                !usedBlockers.has(b.instanceId) &&
                (b.health || 0) > 0
            );
            
            if (blocker) {
                // Only block if it makes strategic sense
                // Block if blocker survives OR trades favorably OR protects significant essence
                const blockerHealth = blocker.healthCurrent || blocker.health || 0;
                const attackerPower = attacker.attack || 0;
                const blockerPower = blocker.attack || 0;
                const attackerHealth = attacker.healthCurrent || attacker.health || 0;
                
                const blockerDies = attackerPower >= blockerHealth;
                const attackerDies = blockerPower >= attackerHealth;
                
                // Block if: we trade, or we survive, or attacker deals 3+ damage to essence
                const shouldBlock = (blockerDies && attackerDies) || 
                                   !blockerDies || 
                                   attackerPower >= 3;
                
                if (shouldBlock) {
                    this.state.combat.declaredBlockers[attacker.instanceId] = blocker;
                    usedBlockers.add(blocker.instanceId);
                    this.log(`${blocker.name} blocks ${attacker.name}`, 'action');
                }
            }
        }
    },
    
    /**
     * Show blocker selection UI for human defender
     */
    showBlockerSelectionUI() {
        const defenderIndex = 1 - this.state.currentPlayer;
        const validBlockers = this.getValidBlockers(defenderIndex);
        
        const overlay = document.getElementById('blocker-overlay') || this.createBlockerOverlay();
        
        const attackersHtml = this.state.combat.declaredAttackers.map(({ card }) => {
            const blocker = this.state.combat.declaredBlockers[card.instanceId];
            return `
                <div class="blocker-attacker-slot" data-attacker-id="${card.instanceId}">
                    <div class="blocker-attacker-card">
                        <img src="${card.image}" alt="${card.name}">
                        <div class="blocker-card-name">${card.name}</div>
                        <div class="blocker-card-stats">${card.attack} / ${card.healthCurrent || card.health}</div>
                    </div>
                    <div class="blocker-arrow">→</div>
                    <div class="blocker-slot ${blocker ? 'assigned' : 'empty'}" 
                         data-attacker-id="${card.instanceId}"
                         onclick="Game.clearBlocker(${card.instanceId})">
                        ${blocker ? `
                            <img src="${blocker.image}" alt="${blocker.name}">
                            <div class="blocker-card-name">${blocker.name}</div>
                        ` : '<span class="no-blocker">No Blocker</span>'}
                    </div>
                </div>
            `;
        }).join('');
        
        const blockersHtml = validBlockers.map(card => {
            const isAssigned = Object.values(this.state.combat.declaredBlockers)
                .some(b => b?.instanceId === card.instanceId);
            return `
                <div class="blocker-available-card ${isAssigned ? 'assigned' : ''}" 
                     data-blocker-id="${card.instanceId}"
                     onclick="Game.selectBlocker(${card.instanceId})">
                    <img src="${card.image}" alt="${card.name}">
                    <div class="blocker-card-name">${card.name}</div>
                    <div class="blocker-card-stats">${card.attack} / ${card.healthCurrent || card.health}</div>
                </div>
            `;
        }).join('');
        
        overlay.innerHTML = `
            <div class="blocker-container">
                <div class="blocker-header">
                    <h2>Declare Blockers</h2>
                    <p>Assign blockers to incoming attackers, or let them through to deal Essence damage</p>
                </div>
                <div class="blocker-attackers">
                    <h3>Incoming Attackers</h3>
                    <div class="blocker-attacker-list">${attackersHtml}</div>
                </div>
                <div class="blocker-available">
                    <h3>Available Blockers</h3>
                    <div class="blocker-available-list">${blockersHtml}</div>
                </div>
                <div class="blocker-actions">
                    <button class="battle-btn confirm" onclick="Game.confirmBlockers()">Confirm Blockers</button>
                    <button class="battle-btn skip" onclick="Game.skipBlockers()">Take All Damage</button>
                </div>
            </div>
        `;
        
        overlay.classList.add('visible');
    },
    
    /**
     * Create the blocker overlay element if it doesn't exist
     */
    createBlockerOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'blocker-overlay';
        overlay.className = 'blocker-overlay';
        document.body.appendChild(overlay);
        return overlay;
    },
    
    /**
     * Hide the blocker overlay
     */
    hideBlockerOverlay() {
        const overlay = document.getElementById('blocker-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    },
    
    /**
     * Player selected a blocker to assign
     */
    selectBlocker(blockerInstanceId) {
        const defenderIndex = 1 - this.state.currentPlayer;
        const player = this.state.players[defenderIndex];
        const blocker = player.avatarRow.find(c => c.instanceId === blockerInstanceId);
        
        if (!blocker) return;
        
        // Check if already assigned
        const isAlreadyAssigned = Object.values(this.state.combat.declaredBlockers)
            .some(b => b?.instanceId === blockerInstanceId);
        
        if (isAlreadyAssigned) {
            this.showPrompt('This blocker is already assigned!');
            return;
        }
        
        // Store for next click on attacker slot
        this.state.combat.pendingBlocker = blocker;
        this.showPrompt(`Select an attacker to block with ${blocker.name}`);
    },
    
    /**
     * Assign pending blocker to an attacker
     */
    assignBlockerToAttacker(attackerInstanceId) {
        const blocker = this.state.combat.pendingBlocker;
        if (!blocker) {
            this.showPrompt('Select a blocker first!');
            return;
        }
        
        const attackerData = this.state.combat.declaredAttackers.find(
            a => a.card.instanceId === attackerInstanceId
        );
        
        if (!attackerData) return;
        
        this.state.combat.declaredBlockers[attackerInstanceId] = blocker;
        this.state.combat.pendingBlocker = null;
        this.log(`${blocker.name} will block ${attackerData.card.name}`, 'action');
        
        this.showBlockerSelectionUI(); // Refresh UI
    },
    
    /**
     * Clear a blocker assignment
     */
    clearBlocker(attackerInstanceId) {
        const blocker = this.state.combat.declaredBlockers[attackerInstanceId];
        if (blocker) {
            this.log(`${blocker.name} no longer blocking`, 'action');
            delete this.state.combat.declaredBlockers[attackerInstanceId];
            this.showBlockerSelectionUI(); // Refresh UI
        }
    },
    
    /**
     * Skip blocking and take all damage
     */
    skipBlockers() {
        this.state.combat.declaredBlockers = {};
        this.log('No blockers declared', 'action');
        this.hideBlockerOverlay();
        this.showBlockerSummaryAndResolve();
    },
    
    /**
     * Confirm blocker assignments and proceed to resolution
     */
    confirmBlockers() {
        const blockerCount = Object.keys(this.state.combat.declaredBlockers).length;
        this.log(`Confirmed ${blockerCount} blockers`, 'phase');
        this.hideBlockerOverlay();
        this.showBlockerSummaryAndResolve();
    },
    
    /**
     * Show summary and resolve all combat simultaneously
     */
    showBlockerSummaryAndResolve() {
        const attackers = this.state.combat.declaredAttackers;
        const blockers = this.state.combat.declaredBlockers;
        
        this.state.combat.mode = 'resolving';
        this.log('=== COMBAT RESOLUTION ===', 'phase');
        
        // Process each attacker
        let delay = 0;
        const delayIncrement = 800;
        
        for (const attackerData of attackers) {
            const attacker = attackerData.card;
            const blocker = blockers[attacker.instanceId];
            
            setTimeout(() => {
                if (blocker) {
                    // Blocked combat - Power vs Guard exchange
                    this.resolveBlockedCombat(attacker, blocker);
                } else {
                    // Unblocked - damage goes to Essence
                    this.resolveUnblockedAttack(attacker);
                }
            }, delay);
            
            delay += delayIncrement;
        }
        
        // After all combat, finalize damage and tap attackers
        setTimeout(() => {
            this.finalizeCombatRound();
        }, delay + 400);
    },
    
    /**
     * Resolve blocked combat using Power vs Guard damage exchange
     */
    resolveBlockedCombat(attacker, blocker) {
        const attackerOwner = this.state.currentPlayer;
        const defenderOwner = 1 - attackerOwner;
        
        const { damageToDefender, damageToAttacker } = this.calculateCombatDamage(attacker, blocker);
        
        this.log(`${attacker.name} (${attacker.attack}) fights ${blocker.name} (${blocker.attack})`, 'action');
        
        // Apply temp damage to both
        this.applyTempDamage(blocker, damageToDefender);
        this.applyTempDamage(attacker, damageToAttacker);
        
        // Visual effects
        this.spawnDamageNumber(`card-${attacker.instanceId}`, damageToAttacker);
        this.spawnDamageNumber(`card-${blocker.instanceId}`, damageToDefender);
        this.screenShake('light');
        
        // Trigger on-attack effects
        this.handleOnAttackTrigger(attacker, blocker, attackerOwner);
        this.handleOnDealDamageTrigger(attacker, damageToDefender, attackerOwner, false);
    },
    
    /**
     * Resolve unblocked attack to opponent's Essence
     */
    resolveUnblockedAttack(attacker) {
        const attackerOwner = this.state.currentPlayer;
        const defenderIndex = 1 - attackerOwner;
        const damage = attacker.attack || 0;
        
        this.log(`${attacker.name} deals ${damage} damage to Essence!`, 'damage');
        
        // Apply damage to Essence
        this.dealDamageToEssence(defenderIndex, damage);
        
        // Trigger on-attack effects
        this.handleOnAttackTrigger(attacker, { type: 'deity', playerIndex: defenderIndex }, attackerOwner);
        this.handleOnDealDamageTrigger(attacker, damage, attackerOwner, true);
    },
    
    /**
     * Finalize combat round - apply permanent damage, destroy dead cards, tap attackers
     */
    finalizeCombatRound() {
        // Finalize all temp damage
        this.finalizeCombatDamage();
        
        // Tap all attackers and mark as attacked
        for (const attackerData of this.state.combat.declaredAttackers) {
            const attacker = attackerData.card;
            attacker.tapped = true;
            this.state.combat.attackedThisTurn.push(attacker.instanceId);
        }
        
        // Check win condition
        this.checkWinCondition();
        
        // Clear combat state
        this.state.combat.declaredAttackers = [];
        this.state.combat.declaredBlockers = {};
        this.state.combat.pendingBlocker = null;
        this.state.combat.mode = null;
        
        this.log('Combat resolved', 'phase');
        this.hidePrompt();
        this.render();
    },

    selectAttacker(card, playerIndex) {
        if (playerIndex !== this.state.currentPlayer) {
            this.showPrompt('You can only attack with your own Avatars!');
            return;
        }
        if (card.tapped) {
            this.showPrompt('This Avatar is tapped and cannot attack!');
            return;
        }
        if (this.state.combat.attackedThisTurn.includes(card.instanceId)) {
            this.showPrompt('This Avatar has already attacked this turn!');
            return;
        }
        if (this.state.combat.summonedThisTurn.includes(card.instanceId)) {
            this.showPrompt('This Avatar has summoning sickness and cannot attack!');
            return;
        }

        this.state.combat.selectedAttacker = card;
        this.state.combat.mode = 'selectTarget';
        this.emitEvent('ON_ATTACK_DECLARED', { attacker: card, playerIndex });
        this.showPrompt('Select a target to attack (enemy Avatar or Deity)');
        this.render();
        
        if (TutorialController.active && playerIndex === 0) {
            TutorialController.onGameEvent('attacker_selected', { card, playerIndex });
        }
    },

    selectTarget(card, playerIndex) {
        if (playerIndex === this.state.currentPlayer) {
            this.showPrompt('You cannot attack your own units!');
            return;
        }
        
        if (!this.validateGuardianTarget(card, playerIndex)) {
            return;
        }

        this.state.combat.selectedTarget = card;
        this.showBattleOverlay();
    },
    
    getGuardians(playerIndex) {
        const p = this.state.players[playerIndex];
        return [...p.avatarRow, ...p.domainRow].filter(c => hasGuardian(c));
    },
    
    validateGuardianTarget(target, defenderIndex) {
        const guardians = this.getGuardians(defenderIndex);
        
        if (guardians.length === 0) return true;
        
        const isTargetGuardian = hasGuardian(target);
        if (!isTargetGuardian) {
            const guardianNames = guardians.map(g => g.name).join(', ');
            this.showPrompt(`Guardian Active! You must attack ${guardianNames} first!`);
            return false;
        }
        
        return true;
    },

    attackDeity(playerIndex) {
        if (this.state.combat.mode !== 'selectTarget') return;
        if (playerIndex === this.state.currentPlayer) {
            this.showPrompt('You cannot attack your own Deity!');
            return;
        }

        const opponent = this.state.players[playerIndex];
        
        const guardians = this.getGuardians(playerIndex);
        if (guardians.length > 0) {
            const guardianNames = guardians.map(g => g.name).join(', ');
            this.showPrompt(`Guardian Active! You must attack ${guardianNames} first!`);
            return;
        }
        
        this.state.combat.selectedTarget = { type: 'deity', playerIndex };
        this.showBattleOverlay();
        
        if (TutorialController.active) {
            TutorialController.onGameEvent('attack_declared', { target: 'deity', playerIndex });
        }
    },

    showBattleOverlay() {
        const overlay = document.getElementById('battle-overlay');
        const attacker = this.state.combat.selectedAttacker;
        const target = this.state.combat.selectedTarget;

        if (!overlay || !attacker || !target) return;

        const isDeity = target.type === 'deity';
        const targetData = isDeity ? this.state.players[target.playerIndex].deity : target;
        
        overlay.innerHTML = `
            <div class="battle-container">
                <div class="battle-card attacker">
                    <img src="${attacker.image}" alt="${attacker.name}">
                    <div class="battle-name">${attacker.name}</div>
                    <div class="battle-stats">
                        <span class="atk">${attacker.attack} ATK</span>
                    </div>
                </div>
                <div class="battle-vs">
                    <div class="vs-text">VS</div>
                    <div class="damage-preview">
                        ${isDeity ? attacker.attack : Math.max(0, attacker.attack - (targetData.healthCurrent || targetData.health))} DMG
                    </div>
                </div>
                <div class="battle-card defender ${isDeity ? 'deity-target' : ''}">
                    <img src="${targetData.image}" alt="${targetData.name}">
                    <div class="battle-name">${targetData.name}</div>
                    <div class="battle-stats">
                        ${isDeity ? `<span class="hp">${this.state.players[target.playerIndex].essence} ESS</span>` : 
                        `<span class="hp">${targetData.healthCurrent || targetData.health} HP</span>`}
                    </div>
                </div>
            </div>
            <div class="battle-actions">
                <button class="battle-btn confirm" onclick="Game.resolveCombat()">ATTACK!</button>
                <button class="battle-btn cancel" onclick="Game.exitCombatMode()">Cancel</button>
            </div>
        `;

        overlay.classList.add('visible');
    },

    hideBattleOverlay() {
        document.getElementById('battle-overlay')?.classList.remove('visible');
    },

    resolveCombat() {
        const attacker = this.state.combat.selectedAttacker;
        const target = this.state.combat.selectedTarget;

        if (!attacker || !target) return;

        this.hideBattleOverlay();
        
        const attackerEl = document.querySelector(`[data-card-id="${attacker.instanceId}"]`);
        if (attackerEl) {
            this.animateAttack(attackerEl, target);
        }

        setTimeout(() => {
            this.handleOnAttackTrigger(attacker, target, this.state.currentPlayer);
            
            if (target.type === 'deity') {
                this.dealDamageToDeity(target.playerIndex, attacker.attack);
                this.handleOnDealDamageTrigger(attacker, attacker.attack, this.state.currentPlayer, true);
            } else {
                this.dealDamageToCard(target, attacker.attack, 1 - this.state.currentPlayer);
                this.dealDamageToCard(attacker, target.attack, this.state.currentPlayer);
                this.handleOnDealDamageTrigger(attacker, attacker.attack, this.state.currentPlayer, false);
            }

            this.state.combat.attackedThisTurn.push(attacker.instanceId);
            attacker.tapped = true;
            
            this.checkWinCondition();
            this.exitCombatMode();
        }, 600);
    },
    
    handleOnAttackTrigger(attacker, target, attackerOwner) {
        if (!this.state.rulesHelper || !attacker.effect) return;
        
        const effect = attacker.effect.toLowerCase();
        
        if (effect.includes('when') && effect.includes('attack')) {
            if (effect.includes('+1 essence damage')) {
                if (target.type === 'deity') {
                    this.adjustStat(target.playerIndex, 'essence', -1);
                    this.log(`${attacker.name}: +1 Essence damage on attack!`, 'damage');
                }
            }
            
            if (effect.includes('draw a card')) {
                this.drawCardEffect(attackerOwner, 1);
                this.log(`${attacker.name}: Drew 1 card on attack`, 'action');
            }
            
            if (effect.includes('+1 kl')) {
                this.adjustStat(attackerOwner, 'kl', 1);
                this.log(`${attacker.name}: +1 KL on attack`, 'action');
            }
        }
    },
    
    handleOnDealDamageTrigger(source, damage, sourceOwner, hitDeity) {
        if (!this.state.rulesHelper || !source.effect) return;
        
        const effect = source.effect.toLowerCase();
        
        if (hitDeity && effect.includes('deals essence damage') && effect.includes('deity')) {
            if (effect.includes('gain') && effect.includes('essence')) {
                const match = effect.match(/gain (\d+) essence/i);
                const amount = match ? parseInt(match[1]) : 1;
                this.adjustStat(sourceOwner, 'essence', amount);
                this.log(`${source.name}: +${amount} Essence (lifesteal)`, 'heal');
            }
            
            if (effect.includes('drain') && effect.includes('kl')) {
                const match = effect.match(/drain (\d+) kl/i);
                const amount = match ? parseInt(match[1]) : 1;
                this.adjustStat(1 - sourceOwner, 'kl', -amount);
                this.log(`${source.name}: Drained ${amount} KL!`, 'damage');
            }
        }
    },

    animateAttack(element, target) {
        if (!element) return;
        
        element.classList.add('attacking');
        
        // Handle deity vs creature attacks separately
        if (target.type === 'deity') {
            // Direct attack on opponent's deity - use directAttack effect
            BattleEffects.directAttack(element, target.playerIndex);
        } else {
            // Creature vs creature combat - use attackSlash if target element exists
            const targetEl = document.querySelector(`[data-card-id="${target.instanceId}"]`);
            if (targetEl) {
                BattleEffects.attackSlash(element, targetEl);
            } else {
                // Fallback: just screen shake if no target element found
                BattleEffects.screenShake(10, 300);
            }
        }
        
        setTimeout(() => {
            element.classList.remove('attacking');
        }, 500);
    },

    dealDamageToCard(card, damage, ownerIndex) {
        if (!card || card.type === 'deity') return;

        card.healthCurrent = (card.healthCurrent || card.health) - damage;
        
        this.showDamageNumber(card, damage);
        this.spawnParticles(card, 'damage');
        
        this.log(`${card.name} takes ${damage} damage!`, 'damage');

        if (card.healthCurrent <= 0) {
            this.destroyCard(card, ownerIndex);
        }

        this.render();
    },

    dealDamageToDeity(playerIndex, damage) {
        const player = this.state.players[playerIndex];
        player.essence -= damage;

        this.showDamageNumber({ type: 'deity', playerIndex }, damage);
        this.spawnParticles({ type: 'deity', playerIndex }, 'damage');
        this.screenShake(damage > 5 ? 'heavy' : 'light');
        
        const essenceBar = document.getElementById(`p${playerIndex + 1}-essence-bar`);
        if (essenceBar) {
            AnimationHelper.play('essence-damage', essenceBar.parentElement, { amount: damage, isHeal: false });
            AnimationHelper.play('stat-pulse', essenceBar.parentElement, { color: 'damage' });
        }
        
        this.log(`Player ${playerIndex + 1}'s Deity takes ${damage} damage!`, 'damage');
        
        if (this.state.matchMode === 'campaign') {
            CampaignManager.applyBossAbility('damage', { targetPlayer: playerIndex, damage });
        }

        if (player.essence <= 0) {
            player.essence = 0;
            this.checkWinCondition();
        }
        
        this.render();
    },

    destroyCard(card, ownerIndex) {
        const player = this.state.players[ownerIndex];
        
        ['front', 'support', 'avatarRow', 'domainRow', 'relicRow'].forEach(zone => {
            if (!player[zone]) return;
            const idx = player[zone].findIndex(c => c.instanceId === card.instanceId);
            if (idx > -1) {
                player[zone].splice(idx, 1);
                player.graveyard.push(card);
            }
        });

        this.spawnParticles(card, 'destroy');
        this.log(`${card.name} was destroyed!`, 'damage');
        
        this.handleOnDeathTrigger(card, ownerIndex);
        this.handleDeityDeathPassive(card, ownerIndex);
        
        const cardEl = document.querySelector(`[data-card-id="${card.instanceId}"]`);
        if (cardEl) {
            BattleEffects.cardDestroyed(cardEl);
            cardEl.classList.add('destroying');
            setTimeout(() => this.render(), 500);
        }
    },
    
    handleOnDeathTrigger(card, ownerIndex) {
        if (!this.state.rulesHelper || !card.effect) return;
        
        const effect = card.effect.toLowerCase();
        
        if (effect.includes('when') && (effect.includes('dies') || effect.includes('destroyed'))) {
            if (effect.includes('opponent loses') && effect.includes('essence')) {
                const match = effect.match(/loses (\d+) essence/i);
                const amount = match ? parseInt(match[1]) : 1;
                this.adjustStat(1 - ownerIndex, 'essence', -amount);
                this.log(`${card.name}: Opponent lost ${amount} Essence on death!`, 'damage');
            }
            
            if (effect.includes('draw')) {
                const match = effect.match(/draw (\d+)/i);
                const amount = match ? parseInt(match[1]) : 1;
                this.drawCardEffect(ownerIndex, amount);
                this.log(`${card.name}: Drew ${amount} card(s) on death`, 'action');
            }
            
            if (effect.includes('gain') && effect.includes('essence')) {
                const match = effect.match(/gain (\d+) essence/i);
                const amount = match ? parseInt(match[1]) : 1;
                this.adjustStat(ownerIndex, 'essence', amount);
                this.log(`${card.name}: +${amount} Essence on death`, 'heal');
            }
        }
    },
    
    handleDeityDeathPassive(card, ownerIndex) {
        if (!this.state.rulesHelper) return;
        
        const player = this.state.players[ownerIndex];
        const deity = player.deity;
        if (!deity || !deity.passive) return;
        
        if (deity.passive === 'Dark Bond' && isBeast(card)) {
            this.adjustStat(1 - ownerIndex, 'essence', -1);
            this.log(`${deity.passive}: Beast died - opponent lost 1 Essence!`, 'damage');
        }
        
        if (deity.passive === 'Grid Drain') {
            const opponent = 1 - ownerIndex;
            if (this.state.currentPlayer !== ownerIndex) {
                this.adjustStat(opponent, 'kl', -1);
                this.log(`${deity.passive}: Enemy Avatar died - drained 1 KL!`, 'damage');
            }
        }
    },

    showDamageNumber(target, damage) {
        const container = document.getElementById('damage-numbers');
        if (!container) return;

        const dmgEl = document.createElement('div');
        dmgEl.className = 'damage-number';
        dmgEl.textContent = `-${damage}`;

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;

        if (target.type === 'deity') {
            const deityEl = document.getElementById(target.playerIndex === 0 ? 'p1-deity' : 'p2-deity');
            if (deityEl) {
                const rect = deityEl.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top + rect.height / 2;
            }
        } else {
            const cardEl = document.querySelector(`[data-card-id="${target.instanceId}"]`);
            if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top + rect.height / 2;
            }
        }

        dmgEl.style.left = x + 'px';
        dmgEl.style.top = y + 'px';
        container.appendChild(dmgEl);

        setTimeout(() => dmgEl.remove(), 1500);
    },

    spawnParticles(target, type = 'damage') {
        const canvas = document.getElementById('particle-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let x = canvas.width / 2;
        let y = canvas.height / 2;

        if (target.type === 'deity') {
            const deityEl = document.getElementById(target.playerIndex === 0 ? 'p1-deity' : 'p2-deity');
            if (deityEl) {
                const rect = deityEl.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top + rect.height / 2;
            }
        } else if (target.instanceId) {
            const cardEl = document.querySelector(`[data-card-id="${target.instanceId}"]`);
            if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top + rect.height / 2;
            }
        }

        const particles = [];
        const colors = type === 'destroy' ? ['#ff4444', '#ff8800', '#ffcc00'] : ['#ff4444', '#ff6666'];
        const count = type === 'destroy' ? 30 : 15;

        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15 - 5,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            particles.forEach(p => {
                if (p.life <= 0) return;
                alive = true;
                
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.3;
                p.life -= 0.02;
                p.size *= 0.98;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.fill();
            });

            ctx.globalAlpha = 1;
            if (alive) requestAnimationFrame(animate);
        };

        animate();
    },

    screenShake(intensity = 'light') {
        const board = document.getElementById('game-board');
        if (!board) return;

        const className = intensity === 'heavy' ? 'shake-heavy' : 'shake-light';
        board.classList.add(className);
        setTimeout(() => board.classList.remove(className), 300);
    },

    showPrompt(message) {
        let prompt = document.getElementById('action-prompt');
        if (!prompt) {
            prompt = document.createElement('div');
            prompt.id = 'action-prompt';
            document.getElementById('game-container').appendChild(prompt);
        }
        prompt.textContent = message;
        prompt.classList.add('visible');
    },

    hidePrompt() {
        document.getElementById('action-prompt')?.classList.remove('visible');
    },

    checkWinCondition() {
        for (let i = 0; i < 2; i++) {
            if (this.state.players[i].essence <= 0) {
                this.state.gameOver = true;
                this.showVictoryScreen(1 - i);
                return true;
            }
        }
        return false;
    },
    
    // === ESSENCE CROWN: Game end handler for various win/loss conditions ===
    triggerGameEnd(winnerIndex, reason = 'essence') {
        this.state.gameOver = true;
        
        // Log the win condition
        const reasonMessages = {
            essence: 'Essence reduced to 0',
            deck_out: 'Deck exhausted (deck out)',
            concede: 'Opponent conceded',
            timeout: 'Turn timer expired'
        };
        this.log(`Game Over: ${reasonMessages[reason] || reason}`, 'phase');
        
        // Store the reason for the victory screen
        this.state.gameEndReason = reason;
        
        // Trigger victory screen
        this.showVictoryScreen(winnerIndex);
    },

    showVictoryScreen(winnerIndex) {
        MatchRecorder.endRecording(winnerIndex);
        
        const playerWon = winnerIndex === 0;
        ShardPath.recordMatchResult(playerWon, this.state.cardsPlayedThisMatch || [], this.state.damageDealtThisMatch || 0);
        
        if (!this.state.isPrivateMatch && this.state.matchMode === 'ranked' && winnerIndex === 0) {
            Matchmaking.updateMMR(true);
        } else if (!this.state.isPrivateMatch && this.state.matchMode === 'ranked' && winnerIndex === 1) {
            Matchmaking.updateMMR(false);
        }
        
        if (this.state.matchMode === 'tournament' && this.state.tournamentMatchId) {
            const playerId = Matchmaking.playerProfile.playerId;
            const winnerId = winnerIndex === 0 ? playerId : 'opponent';
            this.reportTournamentResult(winnerId);
        }
        if (Game.state.isTutorial && winnerIndex === 0) {
            TutorialBattle.onMatchEnd(true);
            return;
        }
        
        if (this.state.matchMode === 'sealed') {
            LimitedMode.endSealed();
        }
        
        let rewardText = '';
        let shardsEarned = 0;
        
        const matchReward = RewardsSystem.getMatchRewards(
            playerWon,
            this.state.matchMode,
            this.state.aiDifficulty
        );
        shardsEarned = matchReward;
        
        if (this.state.isAIMatch && playerWon) {
            AIManager.onMatchEnd(true);
            const rewards = { easy: 232, medium: 247, hard: 272, boss: 322 };
            shardsEarned = rewards[this.state.aiDifficulty] || 247;
        }
        
        if (this.state.matchMode === 'campaign' && playerWon && this.state.currentBoss) {
            CampaignManager.onBossDefeated(this.state.currentBoss.id);
            shardsEarned = this.state.currentBoss.reward;
            rewardText = `<p class="reward-text">BOSS DEFEATED!</p>`;
        }
        
        if (shardsEarned > 0) {
            ShardPath.addCurrency(shardsEarned);
            rewardText += `<p class="reward-text">💎 +${shardsEarned} Shards</p>`;
        }
        
        if (this.state.matchMode === 'ranked' && playerWon && !this.state.isPrivateMatch) {
            const rankResult = RewardsSystem.checkRankUp();
            if (rankResult.rankedUp && rankResult.rewards && !rankResult.rewards.alreadyClaimed) {
                setTimeout(() => {
                    RewardsSystem.showRankUpNotification(rankResult.newTier, rankResult.rewards);
                }, 1500);
            }
        }
        
        PlayerProfile.recordMatch(playerWon, 'Opponent', this.state.matchMode || 'Battle');
        
        EventManager.clearActiveEvent();
        
        // Play victory/defeat music and trigger effects
        if (playerWon) {
            AudioManager.play('victory');
            BattleEffects.victorySequence();
        } else {
            AudioManager.play('defeat');
            BattleEffects.defeatSequence();
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'victory-overlay';
        const tierInfo = Matchmaking.mmoToTier(Matchmaking.playerProfile.mmr);
        const mmrText = this.state.matchMode === 'ranked' ? `<p class="mmr-update">MMR: ${tierInfo.tier} ${tierInfo.level} (${Matchmaking.playerProfile.mmr} MMR)</p>` : '';
        const eventText = this.state.eventId ? `<p class="event-mode">Event Mode</p>` : '';
        const tournamentText = this.state.tournamentId ? `<p class="tournament-mode">Tournament Match</p>` : '';
        
        const winTitle = playerWon ? 'VICTORY' : 'DEFEAT';
        const winMsg = playerWon ? 'You Win!' : 'You Lost...';
        
        overlay.innerHTML = `
            <div class="victory-content ${playerWon ? '' : 'defeat'}">
                <h1 class="victory-title">${winTitle}</h1>
                <p class="victory-text">${winMsg}</p>
                ${rewardText}
                ${mmrText}
                ${eventText}
                ${tournamentText}
                <div class="victory-buttons">
                    <button class="victory-btn" onclick="Game.returnToMenu()">Main Menu</button>
                    <button class="victory-btn secondary" onclick="location.reload()">Play Again</button>
                </div>
            </div>
        `;
        document.getElementById('game-container').appendChild(overlay);
        
        for (let i = 0; i < 50; i++) {
            this.spawnVictoryParticle();
        }
    },
    
    returnToMenu() {
        document.getElementById('victory-overlay')?.remove();
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('game-controls').style.display = 'none';
        document.getElementById('pause-overlay').classList.add('hidden');
        
        // Stop battle effects
        BattleEffects.stopBattleAmbience();
        
        this.state.gameOver = false;
        this.state.isAIMatch = false;
        this.state.matchMode = null;
        this.state.currentBoss = null;
        this.state.selectedDeities = [];
        this.state.turnNumber = 1;
        this.state.currentPhase = 'dawn';
        this.state.currentPlayer = 0;
        
        MainMenu.show();
    },

    recordDeckContents(playerIndex, deck) {
        // Track deck composition for analytics
        if (!MatchRecorder.currentMatch) return;
        if (!MatchRecorder.currentMatch.deckContents) {
            MatchRecorder.currentMatch.deckContents = [{}, {}];
        }
        MatchRecorder.currentMatch.deckContents[playerIndex] = deck.map(c => c.id);
    },
    
    spawnVictoryParticle() {
        const particle = document.createElement('div');
        particle.className = 'victory-particle';
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.animationDelay = Math.random() * 3 + 's';
        particle.style.background = ['#d4af37', '#f4d03f', '#00ffcc', '#ff6b9d'][Math.floor(Math.random() * 4)];
        document.getElementById('victory-overlay')?.appendChild(particle);
    },

    startShardChain(initialLink) {
        this.state.shardChain.active = true;
        this.state.shardChain.links = [initialLink];
        this.state.shardChain.priority = 1 - this.state.currentPlayer;
        this.state.shardChain.passCount = 0;
        
        this.log(`Shard Chain activated: ${initialLink.source.name}`, 'phase');
        this.renderShardChain();
        this.promptForResponse();
    },

    addToShardChain(link) {
        this.state.shardChain.links.push(link);
        this.state.shardChain.priority = 1 - this.state.shardChain.priority;
        this.state.shardChain.passCount = 0;
        
        this.log(`Chain Link ${this.state.shardChain.links.length}: ${link.source.name}`, 'action');
        this.renderShardChain();
        this.promptForResponse();
    },

    passShardChainPriority() {
        this.state.shardChain.passCount++;
        this.state.shardChain.priority = 1 - this.state.shardChain.priority;
        
        if (this.state.shardChain.passCount >= 2) {
            this.resolveShardChain();
        } else {
            this.promptForResponse();
        }
    },

    resolveShardChain() {
        this.log('Resolving Shard Chain...', 'phase');
        
        while (this.state.shardChain.links.length > 0) {
            const link = this.state.shardChain.links.pop();
            this.log(`Resolving: ${link.source.name}`, 'action');
            
            if (link.effect) {
                this.executeShardChainEffect(link);
            }
            
            setTimeout(() => {}, 300);
        }
        
        this.state.shardChain.active = false;
        this.state.shardChain.links = [];
        this.hideShardChainPanel();
        this.render();
    },

    executeShardChainEffect(link) {
        const { source, controller, targets, effect } = link;
        
        if (effect.type === 'damage') {
            targets.forEach(target => {
                if (target.type === 'deity') {
                    this.adjustStat(target.playerIndex, 'essence', -effect.amount);
                    this.spawnParticles({ type: 'deity', playerIndex: target.playerIndex }, 'damage');
                } else if (target.card) {
                    target.card.healthCurrent = (target.card.healthCurrent || target.card.health) - effect.amount;
                    if (target.card.healthCurrent <= 0) {
                        this.destroyCard(target.card, target.playerIndex);
                    }
                }
            });
        } else if (effect.type === 'destroy') {
            targets.forEach(target => {
                if (target.card) {
                    this.destroyCard(target.card, target.playerIndex);
                }
            });
        } else if (effect.type === 'draw') {
            this.drawCardEffect(controller, effect.amount);
        } else if (effect.type === 'heal') {
            this.adjustStat(controller, 'essence', effect.amount);
        } else if (effect.type === 'buff') {
            targets.forEach(target => {
                if (target.card) {
                    target.card.attack = (target.card.attack || 0) + (effect.attackMod || 0);
                    target.card.healthCurrent = (target.card.healthCurrent || target.card.health) + (effect.healthMod || 0);
                }
            });
        }
        
        this.screenShake('light');
    },

    promptForResponse() {
        const priorityPlayer = this.state.shardChain.priority;
        const isAI = priorityPlayer === 1;
        
        if (isAI) {
            setTimeout(() => this.passShardChainPriority(), 800);
        } else {
            this.showPrompt(`Shard Chain active - Respond or Pass`);
        }
    },

    renderShardChain() {
        const panel = document.getElementById('shard-chain-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="shard-chain-header">
                <span class="chain-title">SHARD CHAIN</span>
                <span class="chain-count">${this.state.shardChain.links.length} Link${this.state.shardChain.links.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="shard-chain-links">
                ${this.state.shardChain.links.map((link, i) => `
                    <div class="chain-link" data-index="${i}">
                        <span class="link-number">${i + 1}</span>
                        <span class="link-name">${link.source.name}</span>
                        <span class="link-controller">P${link.controller + 1}</span>
                    </div>
                `).reverse().join('')}
            </div>
            <div class="shard-chain-controls">
                <button class="chain-btn pass-btn" onclick="Game.passShardChainPriority()">PASS</button>
            </div>
        `;
        
        panel.classList.add('visible');
    },

    hideShardChainPanel() {
        document.getElementById('shard-chain-panel')?.classList.remove('visible');
    },

    emitEvent(eventType, data) {
        const handlers = this.state.events[eventType] || [];
        handlers.forEach(handler => handler(data));
        
        this.checkTriggeredAbilities(eventType, data);
    },

    registerEventHandler(eventType, handler) {
        if (!this.state.events[eventType]) {
            this.state.events[eventType] = [];
        }
        this.state.events[eventType].push(handler);
    },

    checkTriggeredAbilities(eventType, data) {
        const currentPlayer = this.state.currentPlayer;
        const p = this.state.players[currentPlayer];
        
        [...p.avatarRow, ...p.domainRow].forEach(card => {
            if (this.hasTriggeredAbility(card, eventType)) {
                this.log(`${card.name} triggers on ${eventType}`, 'action');
            }
        });
    },

    hasTriggeredAbility(card, eventType) {
        if (!card.effect) return false;
        
        const triggers = {
            'ON_AVATAR_SUMMONED': /when.*enter|on.*summon|on.*play/i,
            'ON_ATTACK_DECLARED': /when.*attack|on.*attack/i,
            'ON_AVATAR_DESTROYED': /when.*die|when.*destroy|on.*death/i,
            'ON_ESSENCE_LOSS': /when.*lose.*essence|when.*damage/i
        };
        
        const pattern = triggers[eventType];
        return pattern && pattern.test(card.effect);
    },

    isFastSpell(card) {
        if (card.type !== 'Spell') return false;
        
        const fastPatterns = /quick|instant|counter|in response|during.*phase/i;
        return fastPatterns.test(card.effect || '') || card.speed === 'FAST';
    },

    canPlayDuringShardChain(card, playerIndex) {
        if (!this.state.shardChain.active) return false;
        if (this.state.shardChain.priority !== playerIndex) return false;
        
        return this.isFastSpell(card);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    BattleEffects.init();
    PlayerProfile.init();
    RewardsSystem.init();
    AudioManager.init();
    Game.init();
});

const TutorialBattle = {
    isTutorialActive: false,
    tutorialStep: 0,
    tutorialSteps: [
        { trigger: 'start', title: '🎯 Your First Battle', text: 'Welcome! You\'re about to play your first match. This is a guided tutorial battle - we\'ll help you learn as you play!' },
        { trigger: 'main_phase', title: '🃏 Main Phase', text: 'It\'s the Main Phase - you can now play cards from your hand! Click a card to play it.' },
        { trigger: 'card_played', title: '⚔️ Card Played!', text: 'Great! You played a card. Now it\'s in your Domain Zone. You can play more cards or move to the next phase.' },
        { trigger: 'clash_phase', title: '💥 Clash Phase', text: 'Now it\'s the Clash Phase! Your Avatars can attack the opponent. Click an Avatar, then click the opponent to attack!' },
        { trigger: 'attack_resolved', title: '✨ Attack Landed!', text: 'Excellent! Your attack hit! Keep attacking or let the phase end to finish your turn.' },
        { trigger: 'victory', title: '🏆 Victory!', text: 'You won your first battle! Congratulations, Shardkeeper! You\'ve learned the basics. Now try Solo Battle for real challenges.' }
    ],
    
    start() {
        this.isTutorialActive = true;
        this.tutorialStep = 0;
        
        document.getElementById('main-menu').classList.add('hidden');
        Game.state.matchMode = 'tutorial';
        Game.state.isAIMatch = true;
        Game.state.aiDifficulty = 'easy';
        Game.state.isTutorial = true;
        
        const deities = getDeities();
        Game.state.selectedDeities = [deities[0], deities[5]];
        
        this.showHint(0);
        setTimeout(() => Game.startGameWithMatchMode(), 500);
    },
    
    showHint(stepIndex) {
        if (stepIndex >= this.tutorialSteps.length) return;
        
        const step = this.tutorialSteps[stepIndex];
        const hintEl = document.getElementById('tutorial-hint');
        document.getElementById('hint-text').textContent = step.text;
        hintEl.classList.remove('hidden');
        
        this.tutorialStep = stepIndex;
    },
    
    nextHint() {
        if (this.tutorialStep < this.tutorialSteps.length - 1) {
            this.showHint(this.tutorialStep + 1);
        }
    },
    
    hideHint() {
        document.getElementById('tutorial-hint').classList.add('hidden');
    },
    
    triggerHint(trigger) {
        if (!this.isTutorialActive) return;
        
        const step = this.tutorialSteps.find(s => s.trigger === trigger);
        if (step) {
            this.showHint(this.tutorialSteps.indexOf(step));
        }
    },
    
    onMatchEnd(playerWon) {
        if (playerWon) {
            this.triggerHint('victory');
            setTimeout(() => {
                Game.showVictoryScreen(0);
            }, 2000);
        }
    }
};

Game.openProfileViewer = function() {
    const profile = PlayerProfile.data;
    const tierInfo = Matchmaking.mmoToTier(Matchmaking.playerProfile.mmr);
    
    document.getElementById('profile-name').textContent = profile.name || 'Player';
    document.getElementById('profile-avatar').textContent = profile.avatar || '👑';
    document.getElementById('profile-tier').textContent = `${tierInfo.tier} ${tierInfo.level}`;
    document.getElementById('profile-mmr').textContent = `${Matchmaking.playerProfile.mmr} MMR`;
    
    const wins = profile.stats?.wins || 0;
    const losses = profile.stats?.losses || 0;
    const total = wins + losses;
    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    document.getElementById('profile-wins').textContent = wins;
    document.getElementById('profile-losses').textContent = losses;
    document.getElementById('profile-winrate').textContent = winrate + '%';
    document.getElementById('profile-highest').textContent = RewardsSystem.data.highestTierReached || 'Bronze III';
    
    const matchHistory = (profile.matchHistory || []).slice(-10).reverse();
    const historyHtml = matchHistory.length > 0 ? matchHistory.map(m => `
        <div class="match-entry ${m.won ? 'win' : 'loss'}">
            ${m.won ? '✓' : '✗'} vs ${m.opponent} (${m.deity}) - ${m.mode} - ${new Date(m.date).toLocaleDateString()}
        </div>
    `).join('') : '<div style="color: rgba(255,255,255,0.5);">No matches yet</div>';
    document.getElementById('profile-match-history').innerHTML = historyHtml;
    
    const ownedCosmetics = CosmeticsManager.getCosmeticsOwned();
    const cosmeticsHtml = ownedCosmetics.slice(0, 20).map(c => `
        <div class="cosmetic-preview-mini">
            <div class="cosmetic-preview-mini-icon">${Game.getCosmeticPreviewIcon(c)}</div>
            <div class="cosmetic-preview-mini-name">${c.name}</div>
        </div>
    `).join('');
    document.getElementById('profile-cosmetics-grid').innerHTML = cosmeticsHtml || '<div style="color: rgba(255,255,255,0.5); grid-column: 1/-1;">No cosmetics owned yet</div>';
    
    document.getElementById('profile-viewer-overlay').classList.remove('hidden');
};

Game.closeProfileViewer = function() {
    document.getElementById('profile-viewer-overlay').classList.add('hidden');
};

Game.showProfileTab = function(tab) {
    document.querySelectorAll('.profile-tab').forEach(t => {
        t.classList.toggle('active', t.textContent.toLowerCase().includes(tab.toLowerCase()));
    });
    document.querySelectorAll('.profile-tab-content').forEach(c => {
        c.classList.toggle('active', c.id.includes(tab));
    });
};

CosmeticsManager.getCosmeticsOwned = function() {
    return Object.keys(this.cosmetics)
        .filter(id => this.owned[id])
        .map(id => this.getCosmetic(id));
};
