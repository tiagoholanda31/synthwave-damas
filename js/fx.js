/**
 * SYNTHWAVE DAMAS - VISUAL FX ENGINE v3.0
 * Canvas em resolução HiDPI com: trajetórias que seguem o caminho real de cada salto,
 * explosões de captura, coroação, texto cinético, poeira ambiente e fogos de vitória.
 * As cores vêm do tema ativo (variáveis CSS), não ficam presas ao ciano/magenta.
 */

class SynthwaveFX {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.dpr = 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.particles = [];
        this.shockwaves = [];
        this.floatingTexts = [];
        this.motionTrails = [];
        this.dustParticles = [];
        this.trajectoryProvider = null;
        this.dashOffset = 0;
        this.lastTime = performance.now();

        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.palette = { p1: '#3ee8ff', p2: '#ff4fa3', gold: '#f2c46d', danger: '#ff5a6e' };
        this.displayFont = "'Unbounded', 'Geist', sans-serif";

        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this.initDust();
        });
        this.initDust();
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * Lê as cores do tema ativo.
     */
    refreshPalette() {
        const css = getComputedStyle(document.body);
        const read = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
        this.palette = {
            p1: read('--p1', '#3ee8ff'),
            p2: read('--p2', '#ff4fa3'),
            gold: read('--gold', '#f2c46d'),
            danger: read('--danger', '#ff5a6e')
        };
        for (const p of this.dustParticles) {
            p.color = p.tone === 'p1' ? this.palette.p1 : this.palette.p2;
        }
    }

    color(nameOrHex) {
        return this.palette[nameOrHex] || nameOrHex;
    }

    resize() {
        if (!this.canvas) return;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
        if (this.ctx) this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    initDust() {
        this.dustParticles = [];
        if (this.reducedMotion.matches) return;
        const count = Math.round(Math.min(28, (this.width * this.height) / 52000));
        for (let i = 0; i < count; i++) {
            const tone = Math.random() > 0.5 ? 'p1' : 'p2';
            this.dustParticles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.12,
                vy: -(Math.random() * 0.18 + 0.05),
                size: Math.random() * 1.3 + 0.5,
                tone,
                color: tone === 'p1' ? this.palette.p1 : this.palette.p2,
                alpha: Math.random() * 0.35 + 0.1,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    loop(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        this.update(dt);
        this.render(now);
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.dashOffset = (this.dashOffset - dt * 28) % 20;

        for (const p of this.dustParticles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < -4) {
                p.y = this.height + 4;
                p.x = Math.random() * this.width;
            }
            if (p.x < -4) p.x = this.width + 4;
            if (p.x > this.width + 4) p.x = -4;
        }

        this.tick(this.motionTrails, dt, (tr) => {
            tr.scale += dt * 0.9;
        });

        this.tick(this.particles, dt, (p) => {
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vy += p.gravity * dt * 60;
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.rot += p.vRot * dt;
        });

        this.tick(this.shockwaves, dt, (sw) => {
            sw.radius += sw.speed * dt * 60;
        });

        this.tick(this.floatingTexts, dt, (ft) => {
            ft.y -= ft.vy * dt * 60;
            ft.vy *= 0.96;
        });
    }

    tick(list, dt, step) {
        for (let i = list.length - 1; i >= 0; i--) {
            const item = list[i];
            item.life -= dt;
            if (item.life <= 0) {
                list.splice(i, 1);
                continue;
            }
            step(item);
        }
    }

    render(now) {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.width, this.height);

        this.renderTrajectories(ctx);

        // Poeira ambiente
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.dustParticles) {
            ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(now / 900 + p.phase));
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Rastros de movimento
        for (const tr of this.motionTrails) {
            const k = tr.life / tr.maxLife;
            ctx.save();
            ctx.globalAlpha = k * 0.5;
            ctx.strokeStyle = tr.color;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = tr.color;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(tr.x, tr.y, tr.radius * tr.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Ondas de choque
        for (const sw of this.shockwaves) {
            const k = sw.life / sw.maxLife;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = k * sw.alpha;
            ctx.lineWidth = Math.max(0.5, sw.lineWidth * k);
            if (sw.chromatic) {
                ctx.strokeStyle = this.palette.p2;
                ctx.beginPath();
                ctx.arc(sw.x - 1.5, sw.y, sw.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = this.palette.p1;
                ctx.beginPath();
                ctx.arc(sw.x + 1.5, sw.y, sw.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeStyle = sw.color;
                ctx.shadowColor = sw.color;
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Partículas
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.particles) {
            const k = p.life / p.maxLife;
            ctx.globalAlpha = Math.min(1, k * 1.4);
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            if (p.shape === 'shard') {
                ctx.beginPath();
                ctx.moveTo(0, -p.size);
                ctx.lineTo(p.size * 0.45, 0);
                ctx.lineTo(0, p.size);
                ctx.lineTo(-p.size * 0.45, 0);
                ctx.closePath();
                ctx.fill();
            } else if (p.shape === 'streak') {
                ctx.fillRect(-p.size * 1.8, -0.6, p.size * 3.6, 1.2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size * k + 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();

        // Texto cinético
        for (const ft of this.floatingTexts) {
            const t = 1 - ft.life / ft.maxLife;
            const appear = Math.min(1, t / 0.18);
            const scale = 0.7 + 0.3 * this.easeOutBack(appear);
            const alpha = t > 0.7 ? (1 - t) / 0.3 : appear;
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.translate(ft.x, ft.y);
            ctx.scale(scale, scale);
            ctx.font = `600 ${ft.fontSize}px ${this.displayFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 22;
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, 0, 0);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = Math.max(0, alpha) * 0.92;
            ctx.fillText(ft.text, 0, 0);
            ctx.restore();
        }
    }

    /**
     * Trajetórias recalculadas a cada quadro: acompanham o tabuleiro quando a câmera inclina.
     */
    renderTrajectories(ctx) {
        if (!this.trajectoryProvider) return;
        const list = this.trajectoryProvider();
        if (!list || list.length === 0) return;

        for (const tr of list) {
            const pts = tr.points;
            if (!pts || pts.length < 2) continue;
            const color = tr.isHint ? this.palette.gold : (tr.isCapture ? this.palette.danger : tr.color || this.palette.p1);

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = tr.isCapture ? 2 : 1.6;
            ctx.lineCap = 'round';
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.85;
            ctx.setLineDash([6, 7]);
            ctx.lineDashOffset = this.dashOffset;

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1];
                const b = pts[i];
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                const lift = Math.min(36, len * 0.22);
                ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - lift, b.x, b.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Pousos intermediários de uma captura múltipla
            ctx.fillStyle = color;
            for (let i = 1; i < pts.length - 1; i++) {
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    easeOutBack(x) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }

    setTrajectoryProvider(fn) {
        this.trajectoryProvider = fn;
    }

    clearTrajectories() {
        this.trajectoryProvider = null;
    }

    addMotionTrail(x, y, color = 'p1', radius = 20) {
        if (this.reducedMotion.matches) return;
        this.motionTrails.push({ x, y, radius, scale: 1, life: 0.35, maxLife: 0.35, color: this.color(color) });
    }

    spawnParticles(x, y, count, opts) {
        const n = this.reducedMotion.matches ? Math.ceil(count / 4) : count;
        for (let i = 0; i < n; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin);
            const life = opts.lifeMin + Math.random() * (opts.lifeMax - opts.lifeMin);
            const shapes = opts.shapes || ['shard', 'dot', 'streak'];
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + (opts.lift || 0),
                gravity: opts.gravity || 0,
                friction: opts.friction || 0.92,
                size: opts.sizeMin + Math.random() * (opts.sizeMax - opts.sizeMin),
                color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                rot: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 9,
                life,
                maxLife: life
            });
        }
    }

    /**
     * Explosão de captura: a cor é a do lado capturado.
     */
    triggerCaptureExplosion(x, y, color = 'p2', count = 30) {
        const c = this.color(color);
        this.shockwaves.push({ x, y, radius: 8, speed: 5.5, lineWidth: 3, life: 0.42, maxLife: 0.42, alpha: 0.9, color: c, chromatic: true });
        this.shockwaves.push({ x, y, radius: 14, speed: 3.6, lineWidth: 1.5, life: 0.5, maxLife: 0.5, alpha: 0.7, color: '#ffffff', chromatic: false });
        this.spawnParticles(x, y, count, {
            speedMin: 2.5, speedMax: 8, lifeMin: 0.3, lifeMax: 0.75,
            sizeMin: 1.5, sizeMax: 5, friction: 0.91, gravity: 0.06,
            colors: [c, c, c, '#ffffff']
        });
        this.triggerScreenFlash(color === 'p1' ? 'p1' : 'p2');
    }

    /**
     * Coroação: faíscas douradas ascendentes.
     */
    triggerCrownBurst(x, y) {
        const gold = this.palette.gold;
        this.shockwaves.push({ x, y, radius: 10, speed: 4.2, lineWidth: 3, life: 0.65, maxLife: 0.65, alpha: 0.9, color: gold, chromatic: false });
        this.shockwaves.push({ x, y, radius: 20, speed: 6.5, lineWidth: 1.5, life: 0.7, maxLife: 0.7, alpha: 0.6, color: '#ffffff', chromatic: false });
        this.spawnParticles(x, y, 40, {
            speedMin: 1.5, speedMax: 6, lifeMin: 0.5, lifeMax: 1.1,
            sizeMin: 1.2, sizeMax: 4, friction: 0.94, lift: -2.6, gravity: 0.03,
            colors: [gold, gold, '#fff4d1', '#ffffff'],
            shapes: ['shard', 'dot']
        });
        this.showFloatingText('Dama!', x, y - 26, gold, 22);
        this.triggerScreenFlash('gold');
    }

    showFloatingText(text, x, y, color = 'p1', fontSize = 20) {
        this.floatingTexts.push({
            text, x, y,
            vy: 1.4,
            life: 1.3,
            maxLife: 1.3,
            color: this.color(color),
            fontSize
        });
    }

    /**
     * Tremor de câmera aplicado ao palco, sem quebrar a perspectiva do tabuleiro.
     */
    screenShake(intensity = 4, duration = 220) {
        if (this.reducedMotion.matches) return;
        const target = document.getElementById('board-stage');
        if (!target) return;
        const start = performance.now();
        const shake = (now) => {
            const elapsed = now - start;
            if (elapsed < duration) {
                const decay = 1 - elapsed / duration;
                const dx = (Math.random() - 0.5) * intensity * decay;
                const dy = (Math.random() - 0.5) * intensity * decay;
                target.style.translate = `${dx}px ${dy}px`;
                requestAnimationFrame(shake);
            } else {
                target.style.translate = '';
            }
        };
        requestAnimationFrame(shake);
    }

    triggerScreenFlash(tone = 'p1') {
        const el = document.getElementById('screen-flash');
        if (!el) return;
        const rgbVar = tone === 'gold' ? '--gold-rgb' : (tone === 'p2' ? '--p2-rgb' : '--p1-rgb');
        el.style.setProperty('--flash-rgb', `var(${rgbVar})`);
        el.classList.add('on');
        setTimeout(() => el.classList.remove('on'), 70);
    }

    triggerVictoryFireworks() {
        const colors = [this.palette.p1, this.palette.p2, this.palette.gold, '#ffffff'];
        const bursts = this.reducedMotion.matches ? 1 : 6;
        for (let b = 0; b < bursts; b++) {
            setTimeout(() => {
                const x = this.width * (0.18 + Math.random() * 0.64);
                const y = this.height * (0.16 + Math.random() * 0.36);
                const color = colors[b % colors.length];
                this.shockwaves.push({ x, y, radius: 6, speed: 5, lineWidth: 2.5, life: 0.6, maxLife: 0.6, alpha: 0.8, color, chromatic: false });
                this.spawnParticles(x, y, 46, {
                    speedMin: 2, speedMax: 7.5, lifeMin: 0.7, lifeMax: 1.4,
                    sizeMin: 1, sizeMax: 3.4, friction: 0.955, gravity: 0.05,
                    colors: [color, color, '#ffffff'],
                    shapes: ['dot', 'streak']
                });
            }, b * 260);
        }
    }
}

window.SynthwaveFX = SynthwaveFX;
