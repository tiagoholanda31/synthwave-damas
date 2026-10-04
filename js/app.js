/**
 * SYNTHWAVE DAMAS - BOOTSTRAP
 * Liga áudio, motor, IA, efeitos e UI; cuida de ajustes persistidos, diálogos
 * (foco preso, Esc, retorno de foco), confirmação de ações destrutivas e atalhos.
 */

document.addEventListener('DOMContentLoaded', () => {
    const store = window.SynthStore;
    const audio = window.synthAudio;

    // ------------------------------------------------------------------
    // Ajustes persistidos
    // ------------------------------------------------------------------
    const ALLOWED = {
        mode: ['pve', 'pvp', 'eve'],
        difficulty: ['novice', 'tactical', 'master'],
        rules: ['brazilian', 'casual'],
        theme: ['outrun', 'cyberpunk', 'laser']
    };
    const defaults = { mode: 'pve', difficulty: 'tactical', rules: 'brazilian', theme: 'outrun', view3d: true, sfx: true, haptic: true };
    const settings = { ...defaults, ...store.getJSON('synth_damas_settings', {}) };
    for (const [key, values] of Object.entries(ALLOWED)) {
        if (!values.includes(settings[key])) settings[key] = defaults[key];
    }
    const saveSettings = () => store.set('synth_damas_settings', JSON.stringify(settings));

    const applyTheme = (theme) => {
        [...document.body.classList].filter(c => c.startsWith('theme-')).forEach(c => document.body.classList.remove(c));
        document.body.classList.add(`theme-${theme}`);
    };
    applyTheme(settings.theme);
    audio.setMute(!settings.sfx);

    const engine = new CheckersEngine(settings.rules);
    const ai = new SynthwaveAI(settings.difficulty);
    const fx = new SynthwaveFX('fx-canvas');
    const ui = new SynthwaveUI(engine, ai, fx, audio, { mode: settings.mode, view3d: settings.view3d, theme: settings.theme });

    // ------------------------------------------------------------------
    // Diálogos e gavetas
    // ------------------------------------------------------------------
    const backdrop = document.getElementById('drawer-backdrop');
    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

    const dialogs = (() => {
        const stack = [];
        const isPanel = (el) => el.classList.contains('drawer') || el.classList.contains('feed-panel');

        const syncBackdrop = () => {
            backdrop.classList.toggle('open', stack.some(entry => isPanel(entry.el)));
        };

        const open = (id, { onClose } = {}) => {
            const el = document.getElementById(id);
            if (!el || stack.some(entry => entry.el === el)) return;
            stack.push({ id, el, onClose, returnFocus: document.activeElement });
            el.classList.add('open');
            syncBackdrop();
            requestAnimationFrame(() => {
                const target = el.querySelector('[data-autofocus]') || el.querySelector('.btn-primary') || el.querySelector(FOCUSABLE);
                (target || el).focus({ preventScroll: true });
            });
        };

        const close = (id) => {
            const index = stack.findIndex(entry => entry.id === id);
            if (index === -1) {
                document.getElementById(id)?.classList.remove('open');
                return;
            }
            const [entry] = stack.splice(index, 1);
            entry.el.classList.remove('open');
            syncBackdrop();
            if (entry.returnFocus && document.contains(entry.returnFocus)) {
                entry.returnFocus.focus({ preventScroll: true });
            }
            if (entry.onClose) entry.onClose();
        };

        const closeTop = () => {
            const top = stack[stack.length - 1];
            if (!top) return false;
            close(top.id);
            return true;
        };

        const closePanels = () => {
            [...stack].reverse().filter(entry => isPanel(entry.el)).forEach(entry => close(entry.id));
        };

        // Foco preso no diálogo do topo
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || stack.length === 0) return;
            const el = stack[stack.length - 1].el;
            const items = [...el.querySelectorAll(FOCUSABLE)].filter(n => n.getClientRects().length > 0);
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (!el.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        return {
            open,
            close,
            closeTop,
            closePanels,
            isOpen: (id) => stack.some(entry => entry.id === id),
            anyOpen: () => stack.length > 0
        };
    })();
    ui.dialogs = dialogs;

    backdrop.addEventListener('click', () => dialogs.closePanels());
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) dialogs.close(modal.id);
        });
    });

    // Confirmação para ações que encerram a partida em andamento
    const confirmDialog = ({ title, desc, ok, cancel = 'Continuar jogando' }) => new Promise((resolve) => {
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-desc').textContent = desc;
        okBtn.textContent = ok;
        cancelBtn.textContent = cancel;

        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            dialogs.close('confirm-modal');
            resolve(value);
        };
        okBtn.onclick = () => finish(true);
        cancelBtn.onclick = () => finish(false);
        dialogs.open('confirm-modal', { onClose: () => finish(false) });
    });

    const requestRestart = async () => {
        if (ui.isGameInProgress()) {
            const ok = await confirmDialog({
                title: 'Começar nova partida?',
                desc: 'A partida em andamento será encerrada.',
                ok: 'Nova partida'
            });
            if (!ok) return;
        }
        await ui.restartGame();
    };

    // ------------------------------------------------------------------
    // Áudio
    // ------------------------------------------------------------------
    const musicBtn = document.getElementById('btn-toggle-music');
    const sfxBtn = document.getElementById('btn-toggle-sfx');
    const musicSwitch = document.getElementById('toggle-music');
    const sfxSwitch = document.getElementById('toggle-sfx');

    const syncAudioUI = () => {
        const musicOn = audio.isMusicPlaying;
        const sfxOn = !audio.isMuted;
        musicBtn.setAttribute('aria-pressed', String(musicOn));
        musicSwitch.checked = musicOn;
        sfxBtn.setAttribute('aria-pressed', String(sfxOn));
        sfxBtn.querySelector('use').setAttribute('href', sfxOn ? '#i-speaker' : '#i-speaker-off');
        sfxSwitch.checked = sfxOn;
    };

    const setMusic = (on) => {
        audio.resume();
        if (on) audio.startMusic(); else audio.stopMusic();
        syncAudioUI();
    };

    const setSfx = (on) => {
        audio.setMute(!on);
        settings.sfx = on;
        saveSettings();
        syncAudioUI();
    };

    musicBtn.addEventListener('click', () => setMusic(!audio.isMusicPlaying));
    musicSwitch.addEventListener('change', () => setMusic(musicSwitch.checked));
    sfxBtn.addEventListener('click', () => setSfx(audio.isMuted));
    sfxSwitch.addEventListener('change', () => setSfx(sfxSwitch.checked));

    const bindSlider = (sliderId, outputId, initial, apply) => {
        const slider = document.getElementById(sliderId);
        const output = document.getElementById(outputId);
        const paint = () => {
            slider.style.setProperty('--val', `${slider.value}%`);
            output.textContent = `${slider.value}%`;
        };
        slider.value = Math.round(initial * 100);
        paint();
        slider.addEventListener('input', () => {
            paint();
            apply(Number(slider.value) / 100);
        });
    };
    bindSlider('slider-bgm-vol', 'bgm-vol-val', audio.musicVolume, (v) => audio.setMusicVolume(v));
    bindSlider('slider-sfx-vol', 'sfx-vol-val', audio.sfxVolume, (v) => {
        audio.setSfxVolume(v);
        audio.playHover();
    });

    const hapticSwitch = document.getElementById('toggle-haptic');
    hapticSwitch.checked = settings.haptic;
    hapticSwitch.addEventListener('change', () => {
        settings.haptic = hapticSwitch.checked;
        saveSettings();
    });

    // O navegador só libera o AudioContext depois de um gesto
    const unlockAudio = () => {
        audio.init();
        audio.resume();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // ------------------------------------------------------------------
    // Visão 3D
    // ------------------------------------------------------------------
    const btn3D = document.getElementById('btn-toggle-3d');
    const switch3D = document.getElementById('toggle-3d-setting');
    const set3D = (on) => {
        ui.set3D(on);
        btn3D.setAttribute('aria-pressed', String(on));
        switch3D.checked = on;
        settings.view3d = on;
        saveSettings();
    };
    btn3D.setAttribute('aria-pressed', String(ui.is3D));
    switch3D.checked = ui.is3D;
    btn3D.addEventListener('click', () => set3D(!ui.is3D));
    switch3D.addEventListener('change', () => set3D(switch3D.checked));

    // ------------------------------------------------------------------
    // Ajustes da partida
    // ------------------------------------------------------------------
    const DIFFICULTY_HELP = {
        novice: 'Escolhe lances ao acaso entre os permitidos. Bom para aprender.',
        tactical: 'Calcula 3 lances à frente com minimax.',
        master: 'Calcula 5 lances à frente com minimax e poda alfa-beta.'
    };
    const RULES_HELP = {
        brazilian: 'Dama voadora, captura para trás e lei da maioria.',
        casual: 'Mesmas capturas, sem a lei da maioria: qualquer captura vale.'
    };
    const MODE_NAME = { pve: 'Contra IA', pvp: '2 jogadores', eve: 'IA vs IA' };
    const RULES_NAME = { brazilian: 'Regra brasileira', casual: 'Regra casual' };

    const radios = (name) => [...document.querySelectorAll(`input[name="${name}"]`)];
    const checkRadio = (name, value) => radios(name).forEach(input => { input.checked = input.value === value; });
    const diffField = document.getElementById('field-difficulty');

    const syncSettingsUI = () => {
        checkRadio('game-mode', settings.mode);
        checkRadio('ai-diff', settings.difficulty);
        checkRadio('rules', settings.rules);
        checkRadio('theme', settings.theme);
        document.getElementById('difficulty-help').textContent = DIFFICULTY_HELP[settings.difficulty];
        document.getElementById('rules-help').textContent = RULES_HELP[settings.rules];
        diffField.classList.toggle('is-disabled', settings.mode === 'pvp');
    };
    syncSettingsUI();

    // Troca que reinicia a partida: pede confirmação se houver jogo em andamento
    const bindRestartingSetting = (name, key, apply, describe) => {
        radios(name).forEach(input => input.addEventListener('change', async () => {
            if (!input.checked) return;
            const previous = settings[key];
            if (ui.isGameInProgress()) {
                const ok = await confirmDialog({
                    title: `Trocar para ${describe(input.value)}?`,
                    desc: 'A mudança começa uma nova partida.',
                    ok: 'Trocar e recomeçar'
                });
                if (!ok) {
                    checkRadio(name, previous);
                    return;
                }
            }
            settings[key] = input.value;
            saveSettings();
            apply(input.value);
            syncSettingsUI();
            await ui.restartGame();
            ui.showToast(`${describe(input.value)} · nova partida`, 'ok', 'check');
        }));
    };

    bindRestartingSetting('game-mode', 'mode', (v) => { ui.gameMode = v; }, (v) => MODE_NAME[v]);
    bindRestartingSetting('rules', 'rules', (v) => { engine.ruleMode = v; }, (v) => RULES_NAME[v]);

    radios('ai-diff').forEach(input => input.addEventListener('change', () => {
        if (!input.checked) return;
        settings.difficulty = input.value;
        saveSettings();
        ai.setDifficulty(input.value);
        syncSettingsUI();
        ui.updateHUD();
        ui.showToast(`IA no nível ${input.nextElementSibling.textContent.trim()}`, 'ok', 'gauge');
    }));

    radios('theme').forEach(input => input.addEventListener('change', () => {
        if (!input.checked) return;
        settings.theme = input.value;
        saveSettings();
        applyTheme(input.value);
        ui.onThemeChange(input.value);
    }));

    // ------------------------------------------------------------------
    // Dock, gavetas e modais
    // ------------------------------------------------------------------
    const narrowLayout = window.matchMedia('(max-width: 1023px)');
    const feedPanel = document.getElementById('history-panel');

    const toggleFeed = () => {
        if (narrowLayout.matches) {
            if (dialogs.isOpen('history-panel')) dialogs.close('history-panel');
            else dialogs.open('history-panel');
        } else {
            // No desktop a lista já está visível: só chama atenção para ela
            feedPanel.animate(
                [{ boxShadow: '0 0 0 0 rgba(var(--p1-rgb), 0)' }, { boxShadow: '0 0 0 2px rgba(var(--p1-rgb), .6)' }, { boxShadow: '0 0 0 0 rgba(var(--p1-rgb), 0)' }],
                { duration: 700, easing: 'ease-out' }
            );
        }
    };
    narrowLayout.addEventListener('change', () => {
        if (!narrowLayout.matches && dialogs.isOpen('history-panel')) dialogs.close('history-panel');
    });

    document.getElementById('btn-undo').addEventListener('click', () => ui.undoMove());
    document.getElementById('btn-hint').addEventListener('click', () => ui.showHint());
    document.getElementById('btn-restart').addEventListener('click', requestRestart);
    document.getElementById('btn-history').addEventListener('click', toggleFeed);
    document.getElementById('btn-close-history').addEventListener('click', () => dialogs.close('history-panel'));
    document.getElementById('btn-rules').addEventListener('click', () => dialogs.open('rules-modal'));
    document.getElementById('btn-close-rules').addEventListener('click', () => dialogs.close('rules-modal'));
    document.getElementById('btn-rules-ack').addEventListener('click', () => dialogs.close('rules-modal'));
    document.getElementById('btn-open-drawer').addEventListener('click', () => dialogs.open('matrix-drawer'));
    document.getElementById('btn-close-drawer').addEventListener('click', () => dialogs.close('matrix-drawer'));

    document.getElementById('btn-modal-review').addEventListener('click', () => dialogs.close('game-over-modal'));
    document.getElementById('btn-modal-restart').addEventListener('click', () => ui.restartGame());
    document.getElementById('btn-review-results').addEventListener('click', () => ui.openResults());

    // ------------------------------------------------------------------
    // Atalhos
    // ------------------------------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (dialogs.closeTop()) {
                e.preventDefault();
                return;
            }
            ui.clearSelection();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        if (dialogs.anyOpen()) return;
        if (e.target.matches && e.target.matches('input[type="text"], textarea, select')) return;

        switch (e.key.toLowerCase()) {
            case 'z': ui.undoMove(); break;
            case 'h': ui.showHint(); break;
            case 'l': toggleFeed(); break;
            case 'm': setMusic(!audio.isMusicPlaying); break;
            case 'r': requestRestart(); break;
            case 'v': set3D(!ui.is3D); break;
            default: return;
        }
        e.preventDefault();
    });

    syncAudioUI();
    // Partidas IA vs IA começam sozinhas
    ui.checkAITurn();

    window.synthGame = { engine, ai, fx, ui, audio };
});
