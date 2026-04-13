import React, { useEffect, useMemo, useRef } from 'react';

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t) {
  return t * t * t;
}

function stageT(p, a, b) {
  return clamp((p - a) / (b - a));
}

function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawShadow(ctx, x, y, rx, ry, alpha = 0.18) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function PremiumChefPomodoroScene({
  progress = 0,
  phase = 'FOCUS',
  paused = false
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(performance.now());

  const queueState = useMemo(
    () => [
      { id: 1, tone: '#FFD7B5', shirt: '#8B5CF6' },
      { id: 2, tone: '#F1C27D', shirt: '#10B981' },
      { id: 3, tone: '#E0AC69', shirt: '#F59E0B' },
      { id: 4, tone: '#C68642', shirt: '#EF4444' }
    ],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawBackground = (time, width, height, breakMode) => {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      if (breakMode) {
        g.addColorStop(0, '#0F172A');
        g.addColorStop(0.45, '#111827');
        g.addColorStop(1, '#1E293B');
      } else {
        g.addColorStop(0, '#0F172A');
        g.addColorStop(0.45, '#111827');
        g.addColorStop(1, '#2B1E18');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      const warm = ctx.createRadialGradient(width * 0.5, height * 0.36, 20, width * 0.5, height * 0.36, 360);
      warm.addColorStop(0, breakMode ? 'rgba(148,163,184,0.12)' : 'rgba(255,180,80,0.2)');
      warm.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, width, height);

      const leftGlow = ctx.createRadialGradient(width * 0.14, height * 0.24, 10, width * 0.14, height * 0.24, 260);
      leftGlow.addColorStop(0, 'rgba(59,130,246,0.12)');
      leftGlow.addColorStop(1, 'rgba(59,130,246,0)');
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 18; i += 1) {
        const x = (i * 97 + 37) % width;
        const y = ((i * 63 + 91) % height) * 0.65;
        const r = 1.2 + (i % 3);
        const a = 0.04 + 0.03 * Math.sin(time * 0.001 + i);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, height - 160, width, 160);
    };

    const drawCounter = (width, height) => {
      const y = height - 160;
      const g = ctx.createLinearGradient(0, y, 0, height);
      g.addColorStop(0, '#374151');
      g.addColorStop(1, '#1F2937');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, width, 160);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, y, width, 3);
    };

    const drawBoard = (x, y) => {
      drawShadow(ctx, x + 10, y + 70, 120, 18, 0.16);
      drawRoundedRect(ctx, x - 80, y, 190, 64, 14, '#B77942');
      drawRoundedRect(ctx, x - 70, y + 10, 170, 44, 12, '#CD9258');
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x - 44, y + 12, 88, 4);
    };

    const drawVegetables = (x, y, chopAmount, time) => {
      const pieces = 8;
      for (let i = 0; i < pieces; i += 1) {
        const spread = lerp(12, 45, chopAmount);
        const px = x - 18 + (i % 4) * spread * 0.35 + Math.sin(time * 0.003 + i) * 1.2;
        const py = y + 14 + Math.floor(i / 4) * 14 + (i % 2 ? 1 : -1) * chopAmount * 4;
        const colors = ['#22C55E', '#F97316', '#EF4444', '#FACC15'];
        drawRoundedRect(ctx, px, py, 14 - chopAmount * 4, 10 - chopAmount * 2, 3, colors[i % colors.length]);
      }
    };

    const drawKnife = (x, y, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      drawRoundedRect(ctx, -6, -2, 54, 8, 4, '#D1D5DB');
      drawRoundedRect(ctx, -18, -5, 18, 14, 6, '#6B7280');
      ctx.restore();
    };

    const drawIngredientArc = (fromX, fromY, toX, toY, t) => {
      const arcHeight = 90;
      const x = lerp(fromX, toX, t);
      const y = lerp(fromY, toY, t) - Math.sin(t * Math.PI) * arcHeight;
      const rot = t * 8;
      const items = [
        { dx: -10, dy: -4, c: '#22C55E' },
        { dx: 0, dy: 0, c: '#F97316' },
        { dx: 10, dy: -2, c: '#EF4444' },
        { dx: 4, dy: 8, c: '#FACC15' }
      ];

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      items.forEach((item, i) => {
        ctx.fillStyle = item.c;
        ctx.beginPath();
        ctx.arc(item.dx, item.dy, 5 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const drawPot = (x, y, boilStrength, stirStrength, time, breakMode) => {
      drawShadow(ctx, x, y + 88, 110, 22, 0.22);

      const bodyG = ctx.createLinearGradient(x, y - 10, x, y + 80);
      bodyG.addColorStop(0, '#4B5563');
      bodyG.addColorStop(0.5, '#374151');
      bodyG.addColorStop(1, '#1F2937');
      drawRoundedRect(ctx, x - 92, y, 184, 82, 20, bodyG);

      ctx.strokeStyle = '#9CA3AF';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x - 108, y + 32, 18, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 108, y + 32, 18, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 80, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      const soupG = ctx.createLinearGradient(x, y - 10, x, y + 28);
      soupG.addColorStop(0, breakMode ? '#94A3B8' : '#F59E0B');
      soupG.addColorStop(1, breakMode ? '#64748B' : '#EA580C');
      ctx.fillStyle = soupG;
      ctx.beginPath();
      ctx.ellipse(x, y + 2 + Math.sin(time * 0.01) * boilStrength * 1.6, 70, 12 + boilStrength * 2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (boilStrength > 0.02) {
        for (let i = 0; i < 9; i += 1) {
          const bx = x - 50 + i * 12 + Math.sin(time * 0.004 + i) * 2;
          const by = y + 2 + Math.sin(time * 0.011 + i * 1.7) * 4;
          const r = 2 + ((i % 3) + 1) * boilStrength * 2.4;
          ctx.fillStyle = `rgba(255,240,200,${0.3 + boilStrength * 0.3})`;
          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (stirStrength > 0.02) {
        const spoonAngle = Math.sin(time * 0.01) * 0.45 * stirStrength - 0.3;
        ctx.save();
        ctx.translate(x + 22, y - 28);
        ctx.rotate(spoonAngle);
        drawRoundedRect(ctx, -2, -10, 8, 92, 4, '#D1D5DB');
        ctx.beginPath();
        ctx.ellipse(1, -12, 12, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#E5E7EB';
        ctx.fill();
        ctx.restore();
      }
    };

    const drawSteam = (x, y, amount, time) => {
      if (amount <= 0) return;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i += 1) {
        const sx = x - 42 + i * 16;
        const wobble = Math.sin(time * 0.003 + i) * 10;
        const rise = 10 + i * 2;
        ctx.strokeStyle = `rgba(255,255,255,${0.08 + amount * 0.22})`;
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.bezierCurveTo(sx + wobble, y - 18 - rise, sx - wobble * 0.6, y - 48 - rise, sx + wobble * 0.3, y - 82 - rise);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawPlate = (x, y, alpha = 1, scale = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E5E7EB';
      ctx.beginPath();
      ctx.ellipse(0, -2, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(-4, -3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(6, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawCustomer = ({ x, y, tone, shirt, scale = 1, happy = 0, holding = false, time = 0 }) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      const bounce = Math.sin(time * 0.01 + x * 0.02) * 1.5 * happy;
      drawShadow(ctx, 0, 72, 24, 7, 0.14);
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(0, 6 + bounce, 14, 0, Math.PI * 2);
      ctx.fill();
      drawRoundedRect(ctx, -16, 22 + bounce, 32, 38, 10, shirt);
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, 60 + bounce);
      ctx.lineTo(-12, 84 + bounce);
      ctx.moveTo(10, 60 + bounce);
      ctx.lineTo(12, 84 + bounce);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-14, 34 + bounce);
      ctx.lineTo(-30, 48 + bounce - happy * 6);
      ctx.moveTo(14, 34 + bounce);
      ctx.lineTo(28, 48 + bounce - happy * 8);
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-5, 4 + bounce, 1.5, 0, Math.PI * 2);
      ctx.arc(5, 4 + bounce, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7C2D12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 10 + bounce, 5 + happy * 2, 0.1, Math.PI - 0.1);
      ctx.stroke();
      if (holding) {
        drawPlate(0, 50 + bounce, 1, 0.7);
      }
      ctx.restore();
    };

    const drawChef = ({ x, y, stage, chop, add, boil, stir, serve, time }) => {
      const bodyLean = -0.08 * chop + 0.08 * add + 0.03 * boil + 0.1 * stir + 0.05 * serve;
      const headBob = Math.sin(time * 0.008) * 1.6;
      const rightArmChop = Math.sin(time * 0.024) * 0.9 * chop;
      const addLift = Math.sin(time * 0.014) * 0.35 * add;
      const boilHover = Math.sin(time * 0.006) * 0.18 * boil;
      const leftArmStir = Math.sin(time * 0.013) * 0.5 * stir;
      const serveReach = easeOutCubic(serve) * 54;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bodyLean);
      drawShadow(ctx, 0, 112, 48, 12, 0.18);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -68 + headBob, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F2C9A0';
      ctx.beginPath();
      ctx.arc(0, -34 + headBob, 18, 0, Math.PI * 2);
      ctx.fill();
      drawRoundedRect(ctx, -22, -100 + headBob, 44, 18, 8, '#FFFFFF');
      ctx.beginPath();
      ctx.moveTo(-18, -82 + headBob);
      ctx.quadraticCurveTo(0, -118 + headBob, 18, -82 + headBob);
      ctx.closePath();
      ctx.fill();

      const coatG = ctx.createLinearGradient(0, -10, 0, 86);
      coatG.addColorStop(0, '#FFFFFF');
      coatG.addColorStop(1, '#E5E7EB');
      drawRoundedRect(ctx, -28, -16, 56, 76, 16, coatG);

      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 54);
      ctx.stroke();

      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = '#D1D5DB';
        ctx.beginPath();
        ctx.arc(0, 2 + i * 12, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#F2C9A0';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-22, 6);
      if (stage === 'stir') ctx.lineTo(-48, 24 + leftArmStir * 8);
      else if (stage === 'boil') ctx.lineTo(-42, 24 + boilHover * 8);
      else if (stage === 'serve') ctx.lineTo(-26, 26);
      else ctx.lineTo(-46, 30);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(22, 6);
      if (stage === 'chop') {
        ctx.lineTo(46, 10);
        ctx.lineTo(60, 34 + rightArmChop * 18);
      } else if (stage === 'add') {
        ctx.lineTo(42, -10 - addLift * 12);
        ctx.lineTo(82, -28 - add * 18);
      } else if (stage === 'boil') {
        ctx.lineTo(42, 8);
        ctx.lineTo(78, 4 + boilHover * 10);
      } else if (stage === 'stir') {
        ctx.lineTo(44, 16);
        ctx.lineTo(88, 26 + leftArmStir * 6);
      } else if (stage === 'serve') {
        ctx.lineTo(46 + serveReach * 0.35, 12);
        ctx.lineTo(74 + serveReach, 6);
      } else {
        ctx.lineTo(46, 20);
        ctx.lineTo(62, 30);
      }
      ctx.stroke();

      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-12, 60);
      ctx.lineTo(-14, 104);
      ctx.moveTo(12, 60);
      ctx.lineTo(16, 104);
      ctx.stroke();
      ctx.restore();

      if (stage === 'serve') {
        drawPlate(x + 82 + serveReach, y + 8, 1, 0.82);
      }
    };

    const draw = (now) => {
      if (!running) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const breakMode = phase === 'BREAK';
      const rawTime = now - startRef.current;
      const time = paused ? rawTime * 0.25 : rawTime;
      const safeProgress = clamp(progress);

      ctx.clearRect(0, 0, width, height);

      drawBackground(time, width, height, breakMode);
      drawCounter(width, height);

      const baseY = height - 210;
      const chefPrepX = width * 0.16;
      const chefPrepY = baseY;
      const boardX = width * 0.24;
      const boardY = baseY + 26;
      const potX = width * 0.48;
      const potY = baseY + 18;
      const queueY = baseY + 6;

      const chopT = stageT(safeProgress, 0.0, 0.22);
      const transferT = stageT(safeProgress, 0.22, 0.38);
      const boilT = stageT(safeProgress, 0.38, 0.52);
      const stirT = stageT(safeProgress, 0.52, 0.74);
      const moveServeT = stageT(safeProgress, 0.74, 0.88);
      const serveT = stageT(safeProgress, 0.82, 1.0);

      const chefAtPotX = width * 0.34;
      const chefAtServeX = width * 0.57;
      const chefToPotX = lerp(chefPrepX, chefAtPotX, easeInOut(transferT));
      const chefFromPotToServeX = lerp(chefAtPotX, chefAtServeX, easeInOut(moveServeT));
      const chefX = safeProgress < 0.38 ? chefToPotX : safeProgress < 0.74 ? chefAtPotX : chefFromPotToServeX;
      const chefY = lerp(
        chefPrepY,
        chefPrepY + 6,
        easeInOut(transferT)
      ) - easeInOut(moveServeT) * 8;

      drawBoard(boardX, boardY);
      const boardVegAmount = breakMode ? 0.12 : Math.max(0, easeInOut(chopT) * (1 - easeInOut(transferT)));
      drawVegetables(boardX, boardY + 4, boardVegAmount, time);

      const boilStrength = breakMode ? 0.08 : safeProgress < 0.3 ? 0 : Math.max(easeInOut(boilT), easeInOut(stirT) * 0.6);
      const stirStrength = breakMode ? 0 : safeProgress < 0.52 ? 0 : easeInOut(stirT);
      drawPot(potX, potY, boilStrength, stirStrength, time, breakMode);
      drawSteam(potX, potY - 6, Math.max(boilStrength, stirStrength * 0.8), time);

      if (!breakMode && safeProgress >= 0.22 && safeProgress <= 0.38) {
        const t = easeInOut(transferT);
        drawIngredientArc(boardX + 32, boardY + 6, potX, potY + 8, t);
      }

      const chefStage = breakMode
        ? 'idle'
        : safeProgress < 0.22
          ? 'chop'
          : safeProgress < 0.38
            ? 'add'
            : safeProgress < 0.52
              ? 'boil'
              : safeProgress < 0.82
                ? 'stir'
                : 'serve';

      drawChef({
        x: chefX,
        y: chefY,
        stage: chefStage,
        chop: breakMode ? 0 : easeInOut(chopT),
        add: breakMode ? 0 : easeInOut(transferT),
        boil: breakMode ? 0.15 : easeInOut(boilT),
        stir: breakMode ? 0.08 : easeInOut(stirT),
        serve: breakMode ? 0 : easeInOut(serveT),
        time
      });

      if (!breakMode && safeProgress < 0.22) {
        const ang = -0.8 + Math.sin(time * 0.024) * 0.75 * easeOutCubic(chopT);
        drawKnife(boardX - 24, baseY + 36, ang);
      }

      const counterX = width * 0.67;
      const counterTopY = baseY + 12;
      drawRoundedRect(ctx, counterX - 10, counterTopY, width * 0.14, 58, 16, 'rgba(241,245,249,0.84)', 'rgba(255,255,255,0.08)');
      drawRoundedRect(ctx, counterX, counterTopY + 10, width * 0.12, 8, 6, 'rgba(203,213,225,0.68)');

      const passPlateAlpha = breakMode ? 0.15 : clamp((safeProgress - 0.72) / 0.12, 0, 1);
      drawPlate(counterX + 60, counterTopY + 36, passPlateAlpha, 0.95);

      const queueBaseX = width - 290;
      const queueSpacing = 82;
      const shift = easeOutCubic(serveT) * 54;
      queueState.forEach((person, i) => {
        const baseX = queueBaseX + i * queueSpacing;
        let x = baseX + 80 * (1 - easeInCubic(stageT(safeProgress, 0.72, 0.86)));
        let happy = 0;
        let holding = false;

        if (!breakMode && safeProgress >= 0.82) {
          x = baseX - shift;
          if (i === 0) {
            const reactPhase = clamp((serveT - 0.45) / 0.28);
            holding = serveT > 0.42;
            happy = reactPhase;
            x -= reactPhase * 26;
          }
          if (i === 1) {
            const moveUp = clamp((serveT - 0.55) / 0.28);
            x -= moveUp * 30;
          }
          if (i === 2) {
            const moveUp = clamp((serveT - 0.78) / 0.18);
            x -= moveUp * 16;
          }
        }

        const alphaScale = breakMode ? 0.28 : clamp((safeProgress - 0.74) / 0.18, 0, 1);
        ctx.save();
        ctx.globalAlpha = alphaScale * (1 - i * 0.14);
        drawCustomer({
          x,
          y: queueY,
          tone: person.tone,
          shirt: person.shirt,
          happy,
          holding,
          time
        });
        ctx.restore();
      });

      if (!breakMode && safeProgress >= 0.82) {
        const t = clamp((serveT - 0.08) / 0.36);
        const fromX = chefX + 130;
        const fromY = chefY + 8;
        const toX = queueBaseX - shift;
        const toY = queueY + 50;
        const px = lerp(fromX, toX, easeInOut(t));
        const py = lerp(fromY, toY, easeInOut(t)) - Math.sin(t * Math.PI) * 42;
        drawPlate(px, py, 1, 0.86);
      }

      const stoveGlow = ctx.createRadialGradient(potX, potY + 72, 10, potX, potY + 72, 94);
      stoveGlow.addColorStop(0, breakMode ? 'rgba(148,163,184,0.12)' : `rgba(239,68,68,${0.08 + boilStrength * 0.22})`);
      stoveGlow.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = stoveGlow;
      ctx.fillRect(potX - 120, potY + 20, 240, 140);

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    rafRef.current = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [phase, paused, progress, queueState]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
