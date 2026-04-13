import { useEffect, useRef } from 'react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function KitchenSceneCanvas({ progress, phase, paused }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    let animationFrame = 0;
    let mounted = true;
    const startedAt = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawRoundedRect = (x, y, w, h, r, fillStyle, strokeStyle = null, lineWidth = 1) => {
      context.beginPath();
      context.roundRect(x, y, w, h, r);
      context.fillStyle = fillStyle;
      context.fill();
      if (strokeStyle) {
        context.strokeStyle = strokeStyle;
        context.lineWidth = lineWidth;
        context.stroke();
      }
    };

    const drawQueuePerson = (x, y, scale, opacity, sway) => {
      context.save();
      context.translate(x, y);
      context.scale(scale, scale);
      context.globalAlpha = opacity;

      context.fillStyle = 'rgba(226,232,240,0.9)';
      context.beginPath();
      context.arc(0, -18 + sway, 8, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = 'rgba(226,232,240,0.84)';
      context.lineWidth = 4;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(0, -8 + sway);
      context.lineTo(0, 16 + sway);
      context.moveTo(0, 0 + sway);
      context.lineTo(-11, 9 + sway);
      context.moveTo(0, 0 + sway);
      context.lineTo(11, 9 + sway);
      context.moveTo(0, 16 + sway);
      context.lineTo(-9, 30 + sway);
      context.moveTo(0, 16 + sway);
      context.lineTo(9, 30 + sway);
      context.stroke();
      context.restore();
    };

    const drawChef = (x, y, scale, stateMotion, prepAmount, cookAmount, serveAmount, isBreak) => {
      context.save();
      context.translate(x, y);
      context.scale(scale, scale);

      const bob = Math.sin(stateMotion * 2.2) * (isBreak ? 1.2 : 2.8);
      const armPrep = Math.sin(stateMotion * 7.5) * 14 * prepAmount;
      const armCook = Math.sin(stateMotion * 4.2) * 10 * cookAmount;
      const serveReach = serveAmount * 24;

      context.translate(0, bob);

      context.fillStyle = 'rgba(255,255,255,0.95)';
      context.beginPath();
      context.arc(0, -94, 20, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = 'rgba(255,255,255,0.98)';
      context.beginPath();
      context.ellipse(0, -122, 30, 14, 0, 0, Math.PI * 2);
      context.fill();
      context.fillRect(-20, -122, 40, 16);

      context.fillStyle = 'rgba(251,191,36,0.95)';
      drawRoundedRect(-26, -72, 52, 74, 18, 'rgba(96,165,250,0.94)');

      context.strokeStyle = 'rgba(255,255,255,0.92)';
      context.lineWidth = 8;
      context.lineCap = 'round';

      context.beginPath();
      context.moveTo(-12, 0);
      context.lineTo(-18, 56);
      context.moveTo(12, 0);
      context.lineTo(18, 56);
      context.stroke();

      context.beginPath();
      context.moveTo(-18, -48);
      context.lineTo(-58 + armPrep * 0.35 - armCook * 0.2 + serveReach * 0.2, -20 + armPrep * 0.18);
      context.moveTo(18, -48);
      context.lineTo(52 + armCook * 0.55 + serveReach, -14 - armCook * 0.16 - serveAmount * 10);
      context.stroke();

      context.strokeStyle = 'rgba(203,213,225,0.95)';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(-54 + armPrep * 0.45, -18 + armPrep * 0.16);
      context.lineTo(-82 + armPrep * 0.62, 6 + armPrep * 0.28);
      context.stroke();

      context.restore();
    };

    const draw = (timestamp) => {
      if (!mounted) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const time = (timestamp - startedAt) / 1000;
      const motion = paused ? 0.2 : 1;
      const sceneTime = time * motion;
      const isBreak = phase === 'BREAK';
      const prepAmount = isBreak ? 0 : clamp((0.25 - progress) / 0.25, 0, 1);
      const cookAmount = isBreak ? 0 : clamp((progress - 0.12) / 0.58, 0, 1);
      const serveAmount = isBreak ? 0 : clamp((progress - 0.7) / 0.3, 0, 1);

      context.clearRect(0, 0, width, height);

      const background = context.createLinearGradient(0, 0, 0, height);
      if (isBreak) {
        background.addColorStop(0, '#0b1120');
        background.addColorStop(0.5, '#172033');
        background.addColorStop(1, '#1f2937');
      } else {
        background.addColorStop(0, '#07111f');
        background.addColorStop(0.45, '#17263b');
        background.addColorStop(1, '#35211a');
      }
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const leftGlow = context.createRadialGradient(width * 0.22, height * 0.3, 40, width * 0.22, height * 0.3, width * 0.38);
      leftGlow.addColorStop(0, isBreak ? 'rgba(148,163,184,0.08)' : 'rgba(255,255,255,0.08)');
      leftGlow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = leftGlow;
      context.fillRect(0, 0, width, height);

      const stoveGlow = context.createRadialGradient(width * 0.48, height * 0.58, 50, width * 0.48, height * 0.58, width * 0.34);
      stoveGlow.addColorStop(0, isBreak ? 'rgba(148,163,184,0.1)' : `rgba(251,146,60,${lerp(0.12, 0.28, cookAmount)})`);
      stoveGlow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = stoveGlow;
      context.fillRect(0, 0, width, height);

      drawRoundedRect(width * 0.07, height * 0.18, width * 0.2, 10, 6, 'rgba(255,255,255,0.05)');
      drawRoundedRect(width * 0.53, height * 0.2, width * 0.15, 10, 6, 'rgba(255,255,255,0.04)');

      drawRoundedRect(width * 0.06, height * 0.68, width * 0.84, height * 0.06, 14, 'rgba(168,162,158,0.74)');
      drawRoundedRect(width * 0.04, height * 0.74, width * 0.9, height * 0.15, 16, 'rgba(63,63,70,0.92)');

      const boardX = width * 0.12;
      const boardY = height * 0.56;
      drawRoundedRect(boardX, boardY, width * 0.17, height * 0.07, 20, 'rgba(255,255,255,0.94)', 'rgba(148,163,184,0.3)', 2);

      const ingredientY = boardY + height * 0.035;
      const ingredientBounce = Math.sin(sceneTime * 3.5);
      [
        { x: boardX + width * 0.03, color: '#f97316', r: 10 },
        { x: boardX + width * 0.07, color: '#22c55e', r: 9 },
        { x: boardX + width * 0.11, color: '#ef4444', r: 8 }
      ].forEach((item, index) => {
        context.save();
        context.globalAlpha = isBreak ? 0.35 : 0.95;
        context.fillStyle = item.color;
        context.beginPath();
        context.arc(item.x, ingredientY + ingredientBounce * (2 + index) * prepAmount, item.r, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      drawChef(width * 0.22, height * 0.57, 1.08, sceneTime, prepAmount, cookAmount, serveAmount, isBreak);

      const potX = width * 0.47;
      const potY = height * 0.49;
      drawRoundedRect(potX - 84, potY + 24, 168, 68, 28, 'rgba(30,41,59,0.98)');
      context.strokeStyle = 'rgba(100,116,139,0.84)';
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(potX - 92, potY + 48);
      context.quadraticCurveTo(potX - 116, potY + 34, potX - 104, potY + 12);
      context.moveTo(potX + 92, potY + 48);
      context.quadraticCurveTo(potX + 116, potY + 34, potX + 104, potY + 12);
      context.stroke();

      const liquidLift = lerp(12, 42, cookAmount);
      context.fillStyle = isBreak ? 'rgba(148,163,184,0.34)' : 'rgba(245,158,11,0.88)';
      context.beginPath();
      context.moveTo(potX - 70, potY + 36);
      context.bezierCurveTo(
        potX - 32,
        potY + 12 - liquidLift * 0.3,
        potX + 24,
        potY + 14 - liquidLift * 0.38,
        potX + 70,
        potY + 34
      );
      context.lineTo(potX + 70, potY + 76);
      context.lineTo(potX - 70, potY + 76);
      context.closePath();
      context.fill();

      const spoonBaseX = potX + 24;
      const spoonBaseY = potY - 8;
      const stirArc = Math.sin(sceneTime * 4.2) * 18 * cookAmount;
      context.strokeStyle = 'rgba(226,232,240,0.92)';
      context.lineWidth = 6;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(spoonBaseX, spoonBaseY);
      context.lineTo(spoonBaseX + 50 + stirArc, spoonBaseY - 36 - stirArc * 0.28);
      context.stroke();

      context.fillStyle = 'rgba(226,232,240,0.95)';
      context.beginPath();
      context.arc(spoonBaseX + 52 + stirArc, spoonBaseY - 38 - stirArc * 0.28, 9, 0, Math.PI * 2);
      context.fill();

      const steamOpacity = isBreak ? 0.18 : lerp(0.28, 0.58, cookAmount);
      for (let i = 0; i < 5; i += 1) {
        const drift = Math.sin(sceneTime * 1.5 + i * 0.7) * 9;
        context.strokeStyle = `rgba(255,255,255,${steamOpacity})`;
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(potX - 34 + i * 18, potY + 10);
        context.bezierCurveTo(
          potX - 40 + i * 18 + drift,
          potY - 16 - i * 3,
          potX - 14 + i * 18 - drift,
          potY - 42 - i * 8,
          potX - 18 + i * 18,
          potY - 76 - i * 10
        );
        context.stroke();
      }

      const counterX = width * 0.64;
      const counterY = height * 0.53;
      drawRoundedRect(counterX, counterY, width * 0.16, height * 0.09, 18, 'rgba(241,245,249,0.86)', 'rgba(148,163,184,0.25)', 2);
      drawRoundedRect(counterX + width * 0.01, counterY + height * 0.015, width * 0.14, height * 0.016, 10, 'rgba(203,213,225,0.72)');

      const plateBaseX = counterX + width * 0.05;
      const plateTravel = serveAmount * width * 0.08;
      for (let i = 0; i < 2; i += 1) {
        const plateX = plateBaseX + i * width * 0.05 + (i === 0 ? plateTravel : 0);
        const plateY = counterY + height * 0.046 + Math.sin(sceneTime * 2 + i) * serveAmount * 2;
        context.save();
        context.globalAlpha = 0.28 + serveAmount * 0.72;
        context.fillStyle = 'rgba(226,232,240,0.24)';
        context.beginPath();
        context.ellipse(plateX, plateY + 15, 34, 9, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.96)';
        context.beginPath();
        context.ellipse(plateX, plateY, 36, 12, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(251,146,60,0.9)';
        context.beginPath();
        context.ellipse(plateX, plateY - 3, 20, 7, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      const queueOpacity = isBreak ? 0.12 : clamp((progress - 0.72) / 0.22, 0, 1);
      drawQueuePerson(width * 0.82, height * 0.66, 0.82, queueOpacity * 0.72, Math.sin(sceneTime * 1.4) * 1.4);
      drawQueuePerson(width * 0.88, height * 0.69, 0.72, queueOpacity * 0.5, Math.sin(sceneTime * 1.2 + 0.6) * 1.1);
      drawQueuePerson(width * 0.93, height * 0.71, 0.62, queueOpacity * 0.34, Math.sin(sceneTime * 1.1 + 1.1) * 0.8);

      if (serveAmount > 0) {
        context.strokeStyle = `rgba(255,255,255,${0.18 + serveAmount * 0.26})`;
        context.lineWidth = 3;
        context.setLineDash([8, 10]);
        context.beginPath();
        context.moveTo(counterX + width * 0.09 + plateTravel * 0.8, counterY + height * 0.045);
        context.quadraticCurveTo(width * 0.78, height * 0.58, width * 0.82, height * 0.58);
        context.stroke();
        context.setLineDash([]);
      }

      if (isBreak) {
        context.fillStyle = 'rgba(148,163,184,0.14)';
        context.beginPath();
        context.ellipse(width * 0.48, height * 0.34, 86, 42, 0, 0, Math.PI * 2);
        context.fill();
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      mounted = false;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, [phase, paused, progress]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

export default KitchenSceneCanvas;
