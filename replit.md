# Essence Crown: Shard Wars - TCG Digital Tabletop

## Overview
Essence Crown: Shard Wars is a premium browser-based Trading Card Game (TCG) digital tabletop simulator. Its primary purpose is to provide an immersive and feature-rich platform for playing the Essence Crown: Shard Wars TCG, emphasizing a premium user experience with rich visuals and comprehensive game mechanics. The project aims for a fullscreen-first design and includes a tiered ranking system, a shard-based economy for cosmetics, a full-fledged story campaign, and robust multiplayer functionalities.

## User Preferences
I prefer that the agent focuses on completing tasks directly and efficiently. When implementing new features or making significant changes, please propose the high-level approach first for approval rather than diving straight into detailed implementation. For any UI/UX related tasks, prioritize a "premium cosmic theme" and "anime combat feel" with dramatic visual effects. Ensure all core game rules are strictly enforced and not dependent on user toggles.

## System Architecture
The application is built using pure HTML/CSS/JavaScript, designed for easy embedding as a single HTML file without frameworks or bundlers.

**UI/UX Decisions:**
- **Visual Theme:** Premium cosmic theme with deep purple/blue gradients, theatrical borders, epic shadows, and dramatic lighting. This includes hovering, glowing deity cards, "Anime Combat Feel" with cinematic perspectives, and a rich particle effects engine for combat.
- **Dynamic Effects:** Screen shake, flash, chromatic aberration, slow-motion for critical moments, and diverse card animations (portal summon, spell energy, attack slashes).
- **Thematic Elements:** Cinematic full-screen overlays for phase transitions, banner animations for turn changes, and cinematic golden glow overlays for reward notifications.
- **Arena Design:** Features the "Sun Altar Battlefield Theme" with cosmic stone textures, constellation lines, domain-colored elements, and detailed zone styling. The "New Earth Arena Layout" provides a major UI refactor with a consistent `.ec-*` class structure for the main arena, HUDs, zone panels, and side panels (Codex View, Battle Chronicle).
- **Animation System:** A central `AnimationHelper` class manages various premium animations like card manifest, damage floaters, stat pulses, and victory/defeat overlays.
- **Design System:** The "Essence Shard Tabletop Design System" (Dec 2025) provides a comprehensive card-as-UI component library:
    - Core Components: `.es-card`, `.es-card-header/body/footer`, `.es-nav`, `.es-nav-card`, `.es-btn`, `.es-hero-card`, `.es-scroll`
    - Domain-colored cards: `.es-card[data-domain="second-sun/nullgrid/new-earth/gray-court/shattered-sun"]`
    - Glow utilities: `.es-glow-gold/violet/teal`, `.es-glow-pulse`
    - Typography: `.es-heading-1/2/3`, `.es-text`, `.es-text-muted`
    - Animation utilities: `.es-float`, `.es-sparkle`, `.es-shimmer`, `.es-pulse-gold/violet/teal`, `.es-card-enter`, `.es-crown-glow`, `.es-shard-collect`, `.es-border-animated`
    - Interaction utilities: `.es-lift`, `.es-scale`, `.es-focus`
    - Rarity glows: `.es-rarity-common/rare/epic/legendary/mythic`
    - Enhanced menu/arena/shop/collection styling with premium card-frame aesthetics throughout
- **Accessibility:** Includes text size scaling, colorblind modes, low-FX mode, high contrast, and reduced motion options.
- **Responsiveness:** Fullscreen-first design with responsive grids adapting to screen size.

**Technical Implementations & Feature Specifications:**
- **Card Database:** A complete set of 120 cards, including 11 Deities, 68 Avatars, and 41 Spells, with defined aspects, domains, and rarities.
- **Core Game Mechanics:** Implements all core TCG rules including Deities, Essence, Kundalini (KL), Aspects, defined game Phases, and a Shard Chain (stack/priority system).
- **Battle Engine (Dec 2025 Upgrade):** Enhanced combat system implementing proper TCG battle flow:
    - **Combat Phases:** DECLARE ATTACKERS → DECLARE BLOCKERS → COMBAT RESOLUTION
    - **Blocker Declaration:** Defending player assigns blockers to incoming attackers via overlay UI
    - **Power vs Guard:** Attacker Power damages defender's Guard (health), both cards trade damage simultaneously
    - **tempDamage Tracking:** Combat damage accumulates during resolution, then applied permanently
    - **Domain Limits:** Enforces 1 Domain play per turn (unless card effects override)
    - **Hand Size Limit:** Enforces 7-card hand limit at end of turn, auto-discards excess
    - **Guardian Keyword:** Cards with Guardian must be attacked before Deity can be targeted
    - **Haste/Swift Keyword:** Cards with Haste can attack immediately (no summoning sickness)
    - **Deck-Out Loss:** If player must draw from empty deck (mandatory draw), they lose the game
    - **Win Conditions:** Multiple end-game triggers via `triggerGameEnd()` - essence, deck_out, concede, timeout
    - **AI Blocking Logic:** Strategic AI blocking based on trade evaluation and essence protection
- **Game State Management:** A robust engine for managing game state, rules enforcement, and animations.
- **Player Progression:**
    - **Rewards System:** A 12-tier ranking system with Shard currency, cosmetics, and titles as rewards, including difficulty bonuses.
    - **Shard Shop:** In-game shop for purchasing cosmetics.
    - **Player Profile:** Customizable profiles with personal details, statistics, and history.
- **Audio System:** A full `AudioManager` implementation with background music for various game states, volume controls, and automatic music switching.
- **Game Modes:**
    - **Story Campaign:** "Shards of the Second Sun," a 3-Act, 10-Chapter story-driven campaign with pre/post-battle cutscenes, progressive difficulty, unique boss abilities, and title rewards.
    - **Multiplayer:** Ranked and Casual queues with an MMR system.
    - **Limited Mode (Sealed):** For generating card pools and deck building.
    - **Sandbox Mode:** Manual board state editor for testing.
    - **Custom Lobbies:** For host-defined rules.
    - **Tournaments & Events:** Supports Swiss and Single-Elimination formats.
- **User Experience Enhancements:**
    - **Tutorial System:** Integrates with Campaign Chapter 1 as an interactive walkthrough.
    - **Deck Builder:** A premium three-panel layout with a card pool, real-time deck analytics (KL curve, card types, aspects), and saved deck management, enforcing 60-card deck validity.
    - **Collection Viewer:** For browsing all game assets.
    - **Replay System:** Records and views match actions.
    - **Spectator Mode:** Allows viewing live matches.
    - **Analytics:** Tracks in-game statistics.
- **Persistent Data:** Utilizes `localStorage` for player data such as MMR, friend lists, match replays, analytics, player profile, campaign progress, and saved decks.

## External Dependencies
The project is designed to be self-contained within a single HTML file and relies only on standard browser functionalities and `localStorage` for data persistence. It does not explicitly integrate with external third-party services, APIs, or databases.