/**
 * SYNTHWAVE DAMAS - MAIN APPLICATION BOOTSTRAP
 * Integrates Audio, Engine, AI, FX, UI, Drawer Controls and Event Bindings.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Subsystems
    const audio = window.synthAudio;
    const engine = new CheckersEngine('brazilian');
    const ai = new SynthwaveAI('tactical');
    const fx = new SynthwaveFX('fx-canvas');
    const ui = new SynthwaveUI(engine, ai, fx, audio);

    // 2. Audio & BGM Toggle Handlers
    const musicBtn = document.getElementById('btn-toggle-music');
    const sfxBtn = document.getElementById('btn-toggle-sfx');
    const drawerMusicBtn = document.getElementById('drawer-btn-music');
    const drawerSfxBtn = document.getElementById('drawer-btn-sfx');
    const drawerMusicStatus = document.getElementById('drawer-music-status');
    const drawerSfxStatus = document.getElementById('drawer-sfx-status');

    let sfxMuted = false;

    const updateAudioUI = (musicPlaying, sfxActive) => {
        if (musicBtn) {
            musicBtn.classList.toggle('active', musicPlaying);
            musicBtn.querySelector('.btn-micro-label').textContent = musicPlaying ? 'BGM: ON' : 'BGM';
        }
        if (drawerMusicBtn) {
            drawerMusicBtn.classList.toggle('active', musicPlaying);
            if (drawerMusicStatus) drawerMusicStatus.textContent = musicPlaying ? 'ON' : 'OFF';
        }

        if (sfxBtn) {
            sfxBtn.classList.toggle('active', sfxActive);
            sfxBtn.querySelector('.btn-micro-label').textContent = sfxActive ? 'SFX' : 'MUDO';
        }
        if (drawerSfxBtn) {
            drawerSfxBtn.classList.toggle('active', sfxActive);
            if (drawerSfxStatus) drawerSfxStatus.textContent = sfxActive ? 'ON' : 'MUDO';
        }
    };

    const toggleMusicHandler = () => {
        audio.resume();
        const isPlaying = audio.toggleMusic();
        updateAudioUI(isPlaying, !sfxMuted);
    };

    const toggleSfxHandler = () => {
        sfxMuted = !sfxMuted;
        audio.setMute(sfxMuted);
        updateAudioUI(audio.isMusicPlaying, !sfxMuted);
    };

    if (musicBtn) musicBtn.addEventListener('click', toggleMusicHandler);
    if (drawerMusicBtn) drawerMusicBtn.addEventListener('click', toggleMusicHandler);
    if (sfxBtn) sfxBtn.addEventListener('click', toggleSfxHandler);
    if (drawerSfxBtn) drawerSfxBtn.addEventListener('click', toggleSfxHandler);

    // First user gesture initializes AudioContext seamlessly
    const handleFirstGesture = () => {
        audio.init();
        audio.resume();
        window.removeEventListener('click', handleFirstGesture);
        window.removeEventListener('keydown', handleFirstGesture);
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    // 3. Matrix Settings Drawer Handlers (Menu Discreto)
    const drawer = document.getElementById('matrix-drawer');
    const drawerBackdrop = document.getElementById('matrix-drawer-backdrop');
    const openDrawerBtn = document.getElementById('btn-open-drawer');
    const closeDrawerBtn = document.getElementById('btn-close-drawer');

    const openDrawer = () => {
        if (drawer) drawer.classList.add('open');
        if (drawerBackdrop) drawerBackdrop.classList.add('open');
    };

    const closeDrawer = () => {
        if (drawer) drawer.classList.remove('open');
        if (drawerBackdrop) drawerBackdrop.classList.remove('open');
    };

    if (openDrawerBtn) openDrawerBtn.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

    // 4. Game Control Actions
    const btnUndo = document.getElementById('btn-undo');
    const btnHint = document.getElementById('btn-hint');
    const btnRestart = document.getElementById('btn-restart');
    const btn3D = document.getElementById('btn-toggle-3d');
    const btnModalRestart = document.getElementById('btn-modal-restart');

    if (btnUndo) btnUndo.addEventListener('click', () => ui.undoMove());
    if (btnHint) btnHint.addEventListener('click', () => ui.showHint());
    if (btnRestart) btnRestart.addEventListener('click', () => ui.restartGame());
    if (btnModalRestart) btnModalRestart.addEventListener('click', () => ui.restartGame());

    if (btn3D) {
        btn3D.addEventListener('click', () => {
            const is3D = ui.toggle3D();
            btn3D.classList.toggle('active', is3D);
            const microLabel = btn3D.querySelector('.btn-micro-label');
            if (microLabel) microLabel.textContent = is3D ? '3D' : '2D';
        });
    }

    // 5. Rules Modal Handlers
    const btnRules = document.getElementById('btn-rules');
    const rulesModal = document.getElementById('rules-modal');
    const closeRulesBtn = document.getElementById('btn-close-rules');
    const rulesAckBtn = document.getElementById('btn-rules-ack');

    const openRules = () => { if (rulesModal) rulesModal.classList.add('open'); };
    const closeRules = () => { if (rulesModal) rulesModal.classList.remove('open'); };

    if (btnRules) btnRules.addEventListener('click', openRules);
    if (closeRulesBtn) closeRulesBtn.addEventListener('click', closeRules);
    if (rulesAckBtn) rulesAckBtn.addEventListener('click', closeRules);

    // Close modals on overlay backdrop click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
    });

    // 6. Game Mode Selector (PvE, PvP, EvE)
    const modeSelect = document.getElementById('select-game-mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
            ui.gameMode = e.target.value;
            ui.restartGame();
            ui.showWarningToast(`Modo: ${modeSelect.options[modeSelect.selectedIndex].text}`);
        });
    }

    // 7. AI Difficulty Selector
    const diffSelect = document.getElementById('select-ai-diff');
    if (diffSelect) {
        diffSelect.addEventListener('change', (e) => {
            ai.setDifficulty(e.target.value);
            ui.showWarningToast(`IA Calibrada: ${diffSelect.options[diffSelect.selectedIndex].text}`);
        });
    }

    // 8. Rules Preset Selector
    const rulesSelect = document.getElementById('select-rules-preset');
    if (rulesSelect) {
        rulesSelect.addEventListener('change', (e) => {
            engine.ruleMode = e.target.value;
            ui.restartGame();
            ui.showWarningToast(`Regras: ${rulesSelect.options[rulesSelect.selectedIndex].text}`);
        });
    }

    // 9. Theme Switcher
    const themeSelect = document.getElementById('select-theme');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            document.body.className = `theme-${e.target.value}`;
            ui.showWarningToast(`Tema Synth: ${themeSelect.options[themeSelect.selectedIndex].text}`);
        });
    }

    // 10. Hotkeys for Pro Gamers
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDrawer();
            closeRules();
        } else if (e.key === 'z' || e.key === 'Z') {
            ui.undoMove();
        } else if (e.key === 'h' || e.key === 'H') {
            ui.showHint();
        } else if (e.key === 'm' || e.key === 'M') {
            toggleMusicHandler();
        } else if (e.key === 'r' || e.key === 'R') {
            ui.restartGame();
        }
    });

    console.log('%c⚡ SYNTHWAVE DAMAS ONLINE v2.5 ⚡', 'color: #00f0ff; font-size: 16px; font-weight: bold; background: #0b0217; padding: 6px 12px; border: 1px solid #ff007f; border-radius: 6px;');
});
