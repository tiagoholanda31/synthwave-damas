/**
 * SYNTHWAVE DAMAS - ADVANCED VISUAL FX & PARTICLE ENGINE v2.0
 * Procedural Canvas Engine: Chromatic Aberration Shockwaves, Digital Matrix Debris,
 * Motion Trails, Screen Shake with perspective preservation, and Floating Kinetic Typography.
 */

class SynthwaveFX {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.particles = [];
        this.shockwaves = [];
        this.floatingTexts = [];
        this.motionTrails = [];
        this.dustParticles = [];
        this.lastTime = performance.now();
        this.isRunning = false;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initDust();
        this.start();
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initDust() {
        this.dustParticles = [];
        const count = 40;
        for (let i = 0; i < count; i++) {
            this.dustParticles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.35,
                vy: -Math.random() * 0.45 - 0.1,
                size: Math.random() * 2.2 + 0.8,
                color: Math.random() > 0.5 ? '#00f0ff' : '#ff007f',
                alpha: Math.random() * 0.45 + 0.15
            });
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loop();
    }

    loop() {
        if (!this.isRunning) return;
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.update(dt);
        this.render();

        requestAnimationFrame(() => this.loop());
    }

    update(dt) {
        // 1. Ambient cyber dust
        for (const p of this.dustParticles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < 0) {
                p.y = window.innerHeight;
                p.x = Math.random() * window.innerWidth;
            }
            if (p.x < 0) p.x = window.innerWidth;
            if (p.x > window.innerWidth) p.x = 0;
        }

        // 2. Motion trails
        for (let i = this.motionTrails.length - 1; i >= 0; i--) {
            const tr = this.motionTrails[i];
            tr.life -= dt;
            if (tr.life <= 0) {
                this.motionTrails.splice(i, 1);
                continue;
            }
            tr.scale *= (1 + dt * 0.6);
        }

        // 3. Explosive particles & digital fragments
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.rot += p.vRot * dt;
        }

        // 4. Shockwaves (expanding rings)
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed * dt * 60;
            sw.life -= dt;
            if (sw.life <= 0) {
                this.shockwaves.splice(i, 1);
            }
        }

        // 5. Floating kinetic score & text
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.life -= dt;
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }
            ft.y -= ft.vy * dt * 60;
            ft.scale = Math.min(1.25, ft.scale + dt * 1.8);
        }
    }

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Render ambient cyber dust
        for (const p of this.dustParticles) {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 6;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        // 2. Render motion trails (energy slipstream)
        for (const tr of this.motionTrails) {
            this.ctx.save();
            const alpha = Math.max(0, tr.life / tr.maxLife) * 0.45;
            this.ctx.globalAlpha = alpha;
            this.ctx.strokeStyle = tr.color;
            this.ctx.lineWidth = 2.5;
            this.ctx.shadowColor = tr.color;
            this.ctx.shadowBlur = 14;
            this.ctx.beginPath();
            this.ctx.arc(tr.x, tr.y, tr.radius * tr.scale, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 3. Render chromatic aberration shockwaves
        for (const sw of this.shockwaves) {
            this.ctx.save();
            const progress = 1 - (sw.life / sw.maxLife);
            const alpha = Math.max(0, sw.life / sw.maxLife);
            this.ctx.globalAlpha = alpha;

            // Chromatic split (RGB offset)
            if (sw.chromatic) {
                // Red/Magenta channel
                this.ctx.strokeStyle = '#ff007f';
                this.ctx.lineWidth = sw.lineWidth;
                this.ctx.shadowColor = '#ff007f';
                this.ctx.shadowBlur = 10;
                this.ctx.beginPath();
                this.ctx.arc(sw.x - 2, sw.y, sw.radius, 0, Math.PI * 2);
                this.ctx.stroke();

                // Cyan channel
                this.ctx.strokeStyle = '#00f0ff';
                this.ctx.beginPath();
                this.ctx.arc(sw.x + 2, sw.y, sw.radius, 0, Math.PI * 2);
                this.ctx.stroke();
            } else {
                this.ctx.strokeStyle = sw.color;
                this.ctx.lineWidth = sw.lineWidth * (1 - progress * 0.5);
                this.ctx.shadowColor = sw.color;
                this.ctx.shadowBlur = 16;
                this.ctx.beginPath();
                this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            this.ctx.restore();
        }

        // 4. Render particles (cybersparks, digital fragments)
        for (const p of this.particles) {
            this.ctx.save();
            const alpha = Math.max(0, p.life / p.maxLife);
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 14;

            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rot);

            if (p.shape === 'rect') {
                // Cyber holographic square/data chip
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
            } else if (p.shape === 'beam') {
                // Laser streak
                this.ctx.fillRect(-p.size * 2, -1, p.size * 4, 2);
            } else {
                // Luminous spark
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }

        // 5. Render floating kinetic text (Combos & Score)
        for (const ft of this.floatingTexts) {
            this.ctx.save();
            const alpha = Math.max(0, ft.life / ft.maxLife);
            this.ctx.globalAlpha = alpha;
            this.ctx.translate(ft.x, ft.y);
            this.ctx.scale(ft.scale, ft.scale);

            this.ctx.font = `900 ${ft.fontSize}px 'Orbitron', -apple-system, sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // High-impact neon glow stroke
            this.ctx.strokeStyle = ft.glowColor;
            this.ctx.lineWidth = 6;
            this.ctx.shadowColor = ft.glowColor;
            this.ctx.shadowBlur = 24;
            this.ctx.strokeText(ft.text, 0, 0);

            // Clean crisp inner fill
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(ft.text, 0, 0);

            this.ctx.restore();
        }
    }

    /**
     * Add a glowing motion trail behind moving pieces
     */
    addMotionTrail(x, y, color = '#00f0ff', radius = 24) {
        this.motionTrails.push({
            x,
            y,
            radius,
            scale: 1,
            life: 0.35,
            maxLife: 0.35,
            color
        });
    }

    /**
     * High-tech capture explosion with chromatic aberration shockwave
     */
    triggerCaptureExplosion(x, y, color = '#ff007f', count = 38) {
        // Dual Chromatic Aberration Shockwaves
        this.shockwaves.push({
            x, y, radius: 10, speed: 6.5, lineWidth: 5, life: 0.45, maxLife: 0.45, color, chromatic: true
        });
        this.shockwaves.push({
            x, y, radius: 16, speed: 4.5, lineWidth: 3, life: 0.55, maxLife: 0.55, color: '#ffffff', chromatic: false
        });

        // High-velocity cyber matrix fragments
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 9 + 4;
            const life = Math.random() * 0.48 + 0.32;
            const shapes = ['rect', 'circle', 'beam'];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                friction: 0.93,
                size: Math.random() * 6 + 2.5,
                color: Math.random() > 0.35 ? color : '#ffffff',
                shape,
                rot: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 10,
                life,
                maxLife: life
            });
        }

        // Trigger subtle screen flash
        this.triggerScreenFlash(color === '#00f0ff' ? 'flash-cyan' : 'flash-magenta');
    }

    /**
     * Celebration vortex on King promotion
     */
    triggerCrownBurst(x, y) {
        const goldColor = '#ffd700';
        const cyanColor = '#00f0ff';

        // Dual shockwaves
        this.shockwaves.push({
            x, y, radius: 12, speed: 5, lineWidth: 6, life: 0.65, maxLife: 0.65, color: goldColor, chromatic: false
        });
        this.shockwaves.push({
            x, y, radius: 24, speed: 7.5, lineWidth: 3, life: 0.75, maxLife: 0.75, color: cyanColor, chromatic: true
        });

        // Rising golden cyber-sparks
        for (let i = 0; i < 48; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 2;
            const life = Math.random() * 0.7 + 0.4;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3.2, // Strong ascent
                friction: 0.94,
                size: Math.random() * 5 + 2,
                color: Math.random() > 0.3 ? goldColor : '#ffffff',
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
                rot: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 6,
                life,
                maxLife: life
            });
        }

        this.showFloatingText('👑 DAMA COROADA!', x, y - 24, goldColor, 22);
        this.triggerScreenFlash('flash-cyan');
    }

    /**
     * Show floating combo text (e.g. "COMBO X2!", "ULTRA COMBO X3!")
     */
    showFloatingText(text, x, y, glowColor = '#00f0ff', fontSize = 22) {
        this.floatingTexts.push({
            text,
            x,
            y,
            vy: 1.8,
            scale: 0.75,
            life: 1.25,
            maxLife: 1.25,
            glowColor,
            fontSize
        });
    }

    /**
     * Screen shake without breaking 3D board perspective!
     */
    screenShake(intensity = 6, duration = 240) {
        const target = document.querySelector('.arena-container') || document.body;
        const startTime = performance.now();

        const shake = (now) => {
            const elapsed = now - startTime;
            if (elapsed < duration) {
                const decay = 1 - (elapsed / duration);
                const dx = (Math.random() - 0.5) * intensity * decay;
                const dy = (Math.random() - 0.5) * intensity * decay;
                target.style.transform = `translate(${dx}px, ${dy}px)`;
                requestAnimationFrame(shake);
            } else {
                target.style.transform = '';
            }
        };

        requestAnimationFrame(shake);
    }

    /**
     * Quick radial screen flash
     */
    triggerScreenFlash(flashClass = 'flash-cyan') {
        const flashEl = document.getElementById('screen-flash');
        if (!flashEl) return;
        flashEl.className = `screen-flash ${flashClass}`;
        setTimeout(() => {
            flashEl.className = 'screen-flash';
        }, 120);
    }
}

window.SynthwaveFX = SynthwaveFX;
