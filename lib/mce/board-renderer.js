import MCE, { rc, sq, sqToAlgebraic } from './chess-engine.js';
const SVGns = 'http://www.w3.org/2000/svg';

const THEMES = {
  classic: { light: '#f0d9b5', dark: '#b58863', highlight: 'rgba(255, 255, 0, 0.4)', lastMove: 'rgba(100, 180, 255, 0.3)', dot: 'rgba(0, 0, 0, 0.2)', ring: 'rgba(0, 0, 0, 0.2)', border: '#8b6914', label: 'Classic' },
  cosmic: { light: '#2d3760', dark: '#141c37', highlight: 'rgba(111, 181, 255, 0.35)', lastMove: 'rgba(111, 181, 255, 0.2)', dot: 'rgba(255, 255, 255, 0.25)', ring: 'rgba(255, 255, 255, 0.3)', border: '#0c4f8d', label: 'Cosmic Dark' },
  wood: { light: '#deb887', dark: '#8b5e3c', highlight: 'rgba(255, 215, 0, 0.4)', lastMove: 'rgba(139, 90, 43, 0.3)', dot: 'rgba(0, 0, 0, 0.2)', ring: 'rgba(0, 0, 0, 0.25)', border: '#5c3317', label: 'Classic Wood' },
  marble: { light: '#f2f0ec', dark: '#b8b5af', highlight: 'rgba(100, 149, 237, 0.35)', lastMove: 'rgba(100, 149, 237, 0.2)', dot: 'rgba(0, 0, 0, 0.15)', ring: 'rgba(0, 0, 0, 0.2)', border: '#9e9b95', label: 'Marble' },
  neon: { light: '#1a1a2e', dark: '#0f0f1a', highlight: 'rgba(0, 255, 136, 0.3)', lastMove: 'rgba(0, 200, 255, 0.25)', dot: 'rgba(0, 255, 136, 0.4)', ring: 'rgba(255, 0, 128, 0.5)', border: '#00ff88', label: 'Neon' },
  minimal: { light: '#fafafa', dark: '#e8e8e8', highlight: 'rgba(66, 133, 244, 0.3)', lastMove: 'rgba(66, 133, 244, 0.15)', dot: 'rgba(0, 0, 0, 0.12)', ring: 'rgba(0, 0, 0, 0.15)', border: '#ddd', label: 'Minimal' },
  transparent: { light: 'rgba(128, 128, 128, 0.12)', dark: 'rgba(128, 128, 128, 0.3)', highlight: 'rgba(111, 181, 255, 0.35)', lastMove: 'rgba(111, 181, 255, 0.2)', dot: 'rgba(128, 128, 128, 0.4)', ring: 'rgba(128, 128, 128, 0.45)', border: 'rgba(128, 128, 128, 0.2)', label: 'Transparent' },
};

let currentTheme = 'classic';

const PIECE_STYLES = {
  auto: { label: 'Auto', light: { fill: '#fff', stroke: '#000' }, dark: { fill: '#000', stroke: '#000', detail: '#fff' } },
  gold: { label: 'White & Gold', light: { fill: '#fff', stroke: '#000' }, dark: { fill: '#b58863', stroke: '#5c3a1e', detail: '#f5e6d0' } },
  charcoal: { label: 'Cream & Charcoal', light: { fill: '#f5f0e8', stroke: '#333' }, dark: { fill: '#3a3a3a', stroke: '#1a1a1a', detail: '#ccc' } },
  burgundy: { label: 'White & Burgundy', light: { fill: '#fff', stroke: '#000' }, dark: { fill: '#6b1a2a', stroke: '#3d0f18', detail: '#e8b4bf' } },
  navy: { label: 'White & Navy', light: { fill: '#fff', stroke: '#000' }, dark: { fill: '#1a3a5c', stroke: '#0d1f33', detail: '#a8c4e0' } },
};

let currentPieceStyle = 'auto';

const DARK_THEMES = ['cosmic', 'neon', 'transparent'];

function setPieceStyle(name) {
  if (PIECE_STYLES[name]) currentPieceStyle = name;
}

function getPieceStyle() {
  return currentPieceStyle;
}

function setTheme(name) {
  if (THEMES[name]) currentTheme = name;
}

function getTheme() {
  return THEMES[currentTheme] || THEMES.classic;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVGns, tag);
  if (attrs) Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
  return el;
}

let prevPiecePositions = null;

function renderBoard(container, game, opts) {
  opts = opts || {};
  const rows = game.rows || 8;
  const cols = game.cols || 8;
  const size = opts.size || 480;
  const tileSize = size / cols;
  const height = tileSize * rows;
  const flipped = opts.flipped || false;
  const selected = opts.selected;
  const lastMove = opts.lastMove || null;
  const legalMoves = opts.legalMoves || [];
  const onSquareClick = opts.onSquareClick;

  const animate = opts.animate || false;
  const animStyle = opts.animStyle || 'slide';
  const animDuration = opts.animDuration || 200;
  const animEasing = opts.animEasing || 'ease-out';
  const animArcHeight = opts.animArcHeight || 0.25;
  const animCaptureBurst = opts.animCaptureBurst || false;
  const pendingAnims = [];

  container.innerHTML = '';

  if (opts.surroundRenderer) {
    try { opts.surroundRenderer(container, game, { width: size, height, tileSize, rows, cols, flipped }); } catch (e) { /* don't crash */ }
  }

  const svg = svgEl('svg', { width: size, height: height, viewBox: `0 0 ${size} ${height}` });

  // Draw squares
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dr = flipped ? rows - 1 - r : r;
      const dc = flipped ? cols - 1 - c : c;
      const x = c * tileSize, y = r * tileSize;
      const isLight = (dr + dc) % 2 === 0;
      const sqIdx = MCE.sq(dr, dc, game);

      const theme = getTheme();
      let tileHandled = false;
      if (opts.tilePainter) {
        try {
          const custom = opts.tilePainter(svg, sqIdx, dr, dc, tileSize, isLight, game);
          if (custom) { custom.setAttribute('transform', `translate(${x},${y})`); svg.appendChild(custom); tileHandled = true; }
        } catch (e) { /* fall through to default */ }
      }
      if (!tileHandled) {
        const rect = svgEl('rect', {
          x, y, width: tileSize, height: tileSize,
          fill: isLight ? theme.light : theme.dark,
        });
        svg.appendChild(rect);
      }

      if (!opts.suppressHighlights) {
        if (lastMove && (sqIdx === lastMove.from || sqIdx === lastMove.to)) {
          svg.appendChild(svgEl('rect', {
            x, y, width: tileSize, height: tileSize, fill: theme.lastMove,
          }));
        }

        if (sqIdx === selected) {
          svg.appendChild(svgEl('rect', {
            x, y, width: tileSize, height: tileSize, fill: theme.highlight,
          }));
        }
      }
    }
  }

  // Draw legal move indicators
  for (const move of legalMoves) {
    const [tr, tc] = MCE.rc(move.to, game);
    const dr = flipped ? rows - 1 - tr : tr;
    const dc = flipped ? cols - 1 - tc : tc;
    const x = dc * tileSize, y = dr * tileSize;
    const cx = x + tileSize / 2;
    const cy = y + tileSize / 2;
    const isCapture = game.board[move.to] || move.flag === 'ep';

    if (opts.legalMoveRenderer) {
      try {
        const el = opts.legalMoveRenderer(svg, move, x, y, tileSize, isCapture, game);
        if (el) svg.appendChild(el);
      } catch (e) { /* fall through to default */ }
      continue;
    }

    const theme = getTheme();
    if (isCapture) {
      svg.appendChild(svgEl('circle', {
        cx, cy, r: tileSize * 0.45,
        fill: 'none', stroke: theme.ring, 'stroke-width': tileSize * 0.08,
      }));
    } else {
      svg.appendChild(svgEl('circle', {
        cx, cy, r: tileSize * 0.15, fill: theme.dot,
      }));
    }
  }

  // Draw effect overlays
  if (opts.effectOverlay && game.effects && game.effects.length > 0) {
    try {
      for (const effect of game.effects) {
        const [er, ec] = MCE.rc(effect.sq, game);
        const edr = flipped ? rows - 1 - er : er;
        const edc = flipped ? cols - 1 - ec : ec;
        const el = opts.effectOverlay(svg, effect, edc * tileSize, edr * tileSize, tileSize, game);
        if (el) svg.appendChild(el);
      }
    } catch (e) { /* don't crash */ }
  }

  // Draw fog overlay
  const fogMask = opts.fogMask || null;
  if (fogMask) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dr = flipped ? rows - 1 - r : r;
        const dc = flipped ? cols - 1 - c : c;
        const sqIdx = MCE.sq(dr, dc, game);
        if (!fogMask.has(sqIdx)) {
          svg.appendChild(svgEl('rect', {
            x: c * tileSize, y: r * tileSize, width: tileSize, height: tileSize,
            fill: 'rgba(0,0,0,0.6)',
          }));
        }
      }
    }
  }

  // Build current piece positions map
  const excludeSq = opts.excludePiece !== undefined ? opts.excludePiece : -1;
  const excludeSet = opts.excludePieces || null;
  const currentPositions = new Map();
  const total = rows * cols;
  for (let i = 0; i < total; i++) {
    if (i === excludeSq) continue;
    if (excludeSet && excludeSet.indexOf(i) >= 0) continue;
    const p = game.board[i];
    if (!p) continue;
    if (fogMask && !fogMask.has(i)) continue;
    const [pr, pc] = MCE.rc(i, game);
    const dr = flipped ? rows - 1 - pr : pr;
    const dc = flipped ? cols - 1 - pc : pc;
    const x = dc * tileSize + tileSize * 0.05;
    const y = dr * tileSize + tileSize * 0.05;
    currentPositions.set(i, { piece: p, x, y });
  }

  // Determine which piece to animate and whether it's a capture
  let animateFromX = null, animateFromY = null, animateToSq = null;
  let isAnimCapture = false;
  if (animate && lastMove && prevPiecePositions) {
    const fromSq = lastMove.from;
    const toSq = lastMove.to;
    const prev = prevPiecePositions.get(fromSq);
    if (prev && currentPositions.has(toSq)) {
      animateFromX = prev.x;
      animateFromY = prev.y;
      animateToSq = toSq;
      isAnimCapture = prevPiecePositions.has(toSq) && prevPiecePositions.get(toSq).piece !== currentPositions.get(toSq).piece;
    }
  }

  // Draw pieces
  for (const [sqIdx, pos] of currentPositions) {
    let pieceEl = null;
    if (opts.pieceProvider) {
      try { pieceEl = opts.pieceProvider(game, sqIdx, tileSize); } catch (e) { /* fall through */ }
    }
    if (!pieceEl) {
      const pieceSize = tileSize * 0.9;
      const isDark = pos.piece === pos.piece.toLowerCase();
      const style = getActivePieceColors(isDark);
      if (style) {
        pieceEl = createColoredPiece(pos.piece, pieceSize, style, isDark);
      } else {
        pieceEl = svgEl('use', {
          href: '#piece-' + pos.piece,
          width: pieceSize,
          height: pieceSize,
        });
      }
    }

    const isColored = pieceEl._isColoredPiece;
    if (animate && sqIdx === animateToSq && animateFromX !== null) {
      if (animStyle === 'warp') {
        if (isColored) {
          pieceEl.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
        } else {
          pieceEl.setAttribute('x', pos.x);
          pieceEl.setAttribute('y', pos.y);
        }
        svg.appendChild(pieceEl);
        const ghostEl = pieceEl.cloneNode(true);
        if (isColored) {
          ghostEl.setAttribute('transform', `translate(${animateFromX}, ${animateFromY})`);
        } else {
          ghostEl.setAttribute('x', animateFromX);
          ghostEl.setAttribute('y', animateFromY);
          ghostEl.removeAttribute('transform');
        }
        svg.appendChild(ghostEl);
        animateWarp(pieceEl, ghostEl, isColored, animateFromX, animateFromY, pos.x, pos.y, animDuration);
      } else if (animStyle === 'arc') {
        if (isColored) {
          pieceEl.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
          svg.appendChild(pieceEl);
          animateArcG(pieceEl, animateFromX, animateFromY, pos.x, pos.y, tileSize, animDuration, animArcHeight);
        } else {
          pieceEl.setAttribute('x', pos.x);
          pieceEl.setAttribute('y', pos.y);
          pieceEl.setAttribute('transform', 'translate(0, 0)');
          svg.appendChild(pieceEl);
          animateArc(svg, pieceEl, animateFromX, animateFromY, pos.x, pos.y, tileSize, animDuration, animArcHeight, pos.piece);
        }
      } else if (animStyle === 'bounce') {
        if (isColored) {
          pieceEl.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
          svg.appendChild(pieceEl);
          animateBounceG(pieceEl, animateFromX, animateFromY, pos.x, pos.y, animDuration);
        } else {
          pieceEl.setAttribute('x', pos.x);
          pieceEl.setAttribute('y', pos.y);
          pieceEl.setAttribute('transform', 'translate(0, 0)');
          svg.appendChild(pieceEl);
          animateBounce(pieceEl, animateFromX, animateFromY, pos.x, pos.y, animDuration);
        }
      } else {
        if (isColored) {
          pieceEl.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
          const animEl = document.createElementNS(SVGns, 'animateTransform');
          animEl.setAttribute('attributeName', 'transform');
          animEl.setAttribute('type', 'translate');
          animEl.setAttribute('from', `${animateFromX} ${animateFromY}`);
          animEl.setAttribute('to', `${pos.x} ${pos.y}`);
          animEl.setAttribute('dur', animDuration + 'ms');
          animEl.setAttribute('fill', 'freeze');
          animEl.setAttribute('begin', 'indefinite');
          pieceEl.appendChild(animEl);
          svg.appendChild(pieceEl);
          pendingAnims.push(animEl);
        } else {
          pieceEl.setAttribute('x', pos.x);
          pieceEl.setAttribute('y', pos.y);
          const animEl = document.createElementNS(SVGns, 'animateTransform');
          animEl.setAttribute('attributeName', 'transform');
          animEl.setAttribute('type', 'translate');
          animEl.setAttribute('from', `${animateFromX - pos.x} ${animateFromY - pos.y}`);
          animEl.setAttribute('to', '0 0');
          animEl.setAttribute('dur', animDuration + 'ms');
          animEl.setAttribute('fill', 'freeze');
          animEl.setAttribute('begin', 'indefinite');
          pieceEl.appendChild(animEl);
          svg.appendChild(pieceEl);
          pendingAnims.push(animEl);
        }
      }
    } else {
      if (isColored) {
        pieceEl.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      } else {
        pieceEl.setAttribute('x', pos.x);
        pieceEl.setAttribute('y', pos.y);
      }
      svg.appendChild(pieceEl);
    }
  }

  // Capture burst effect
  if (animate && animCaptureBurst && isAnimCapture && animateToSq !== null) {
    const pos = currentPositions.get(animateToSq);
    if (pos) {
      const burstDelay = animStyle === 'arc' ? animDuration : animDuration * 0.8;
      setTimeout(() => captureBurst(svg, pos.x + tileSize * 0.45, pos.y + tileSize * 0.45, tileSize), burstDelay);
    }
  }

  // Save positions for next render
  prevPiecePositions = currentPositions;

  // Draw duck
  const duckSq = opts.duckSq;
  if (duckSq !== null && duckSq !== undefined && duckSq >= 0) {
    const [dr2, dc2] = MCE.rc(duckSq, game);
    const ddr = flipped ? rows - 1 - dr2 : dr2;
    const ddc = flipped ? cols - 1 - dc2 : dc2;
    const cx = ddc * tileSize + tileSize / 2;
    const cy = ddr * tileSize + tileSize / 2;
    svg.appendChild(svgEl('circle', {
      cx, cy, r: tileSize * 0.35,
      fill: '#f5c542', stroke: '#b8860b', 'stroke-width': 2,
    }));
    const txt = svgEl('text', {
      x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': tileSize * 0.3, fill: '#6b4c00',
    });
    txt.textContent = '🦆';
    svg.appendChild(txt);
  }

  // Click handler
  if (onSquareClick) {
    const overlay = svgEl('rect', {
      x: 0, y: 0, width: size, height: height,
      fill: 'transparent', style: 'cursor:pointer',
    });
    overlay.addEventListener('pointerup', (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
      const c = Math.floor(svgPt.x / tileSize);
      const r = Math.floor(svgPt.y / tileSize);
      const dr = flipped ? rows - 1 - r : r;
      const dc = flipped ? cols - 1 - c : c;
      if (dr >= 0 && dr < rows && dc >= 0 && dc < cols) {
        onSquareClick(MCE.sq(dr, dc, game));
      }
    });
    svg.appendChild(overlay);
  }

  if (opts.afterRender) {
    try { opts.afterRender(svg, game, tileSize, opts); } catch (e) { /* don't crash the board */ }
  }

  container.appendChild(svg);

  if (pendingAnims.length > 0) {
    for (let i = 0; i < pendingAnims.length; i++) {
      pendingAnims[i].beginElement();
    }
  }

  return svg;
}

function getActivePieceColors(isDark) {
  const ps = PIECE_STYLES[currentPieceStyle];
  if (!ps) return null;
  if (currentPieceStyle === 'auto') {
    if (DARK_THEMES.includes(currentTheme)) {
      return isDark ? { fill: '#4a7a9b', stroke: '#1a3a5c', detail: '#c8dce8' } : null;
    }
    return null;
  }
  return isDark ? ps.dark : ps.light;
}

function createColoredPiece(piece, size, colors, isDark) {
  const symbolEl = document.getElementById('piece-' + piece);
  if (!symbolEl) {
    return svgEl('use', { href: '#piece-' + piece, width: size, height: size });
  }
  const outer = document.createElementNS(SVGns, 'g');
  const vb = symbolEl.getAttribute('viewBox') || '0 0 45 45';
  const parts = vb.split(/\s+/);
  const vbW = parseFloat(parts[2]) || 45;
  const scale = size / vbW;
  const inner = document.createElementNS(SVGns, 'g');
  inner.setAttribute('transform', 'scale(' + scale + ')');

  const content = symbolEl.innerHTML;
  const tmp = document.createElementNS(SVGns, 'svg');
  tmp.innerHTML = content;

  function recolorNode(node) {
    if (node.nodeType !== 1) return;
    var s = node.getAttribute('style');
    if (s) {
      if (isDark) {
        s = s.replace(/fill\s*:\s*#000/gi, 'fill:' + colors.fill);
        s = s.replace(/fill\s*:\s*#fff/gi, 'fill:' + (colors.detail || '#fff'));
        s = s.replace(/stroke\s*:\s*#000/gi, 'stroke:' + colors.stroke);
        s = s.replace(/stroke\s*:\s*#fff/gi, 'stroke:' + (colors.detail || '#fff'));
      } else {
        s = s.replace(/fill\s*:\s*#fff/gi, 'fill:' + colors.fill);
        s = s.replace(/fill\s*:\s*#000/gi, 'fill:' + colors.stroke);
        s = s.replace(/stroke\s*:\s*#000/gi, 'stroke:' + colors.stroke);
        s = s.replace(/stroke\s*:\s*#fff/gi, 'stroke:' + colors.fill);
      }
      node.setAttribute('style', s);
    }
    var fill = node.getAttribute('fill');
    if (fill === '#000' || fill === '#fff') {
      if (isDark) {
        node.setAttribute('fill', fill === '#000' ? colors.fill : (colors.detail || '#fff'));
      } else {
        node.setAttribute('fill', fill === '#fff' ? colors.fill : colors.stroke);
      }
    }
    var stroke = node.getAttribute('stroke');
    if (stroke === '#000' || stroke === '#fff') {
      if (isDark) {
        node.setAttribute('stroke', stroke === '#000' ? colors.stroke : (colors.detail || '#fff'));
      } else {
        node.setAttribute('stroke', stroke === '#000' ? colors.stroke : colors.fill);
      }
    }
    for (var i = 0; i < node.children.length; i++) {
      recolorNode(node.children[i]);
    }
  }

  for (var i = 0; i < tmp.children.length; i++) {
    var clone = tmp.children[i].cloneNode(true);
    recolorNode(clone);
    inner.appendChild(clone);
  }
  outer.appendChild(inner);
  outer._isColoredPiece = true;
  return outer;
}

function animateArc(svg, use, fromX, fromY, toX, toY, tileSize, duration, arcFactor, piece) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const arcHeight = Math.min(dist * arcFactor, tileSize * 0.8);
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);

    const ease = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const cx = fromX + dx * ease;
    const cy = fromY + dy * ease;
    const arc = arcHeight * 4 * t * (1 - t);
    const scale = 1 + 0.15 * Math.sin(t * Math.PI);

    const offsetX = cx - toX;
    const offsetY = (cy - arc) - toY;
    use.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      use.setAttribute('transform', 'translate(0, 0)');
    }
  }

  const offsetX = fromX - toX;
  const offsetY = fromY - toY;
  use.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
  requestAnimationFrame(frame);
}

function animateArcG(el, fromX, fromY, toX, toY, tileSize, duration, arcFactor) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const arcHeight = Math.min(dist * arcFactor, tileSize * 0.8);
  const startTime = performance.now();

  function frame(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const cx = fromX + dx * ease;
    const cy = fromY + dy * ease;
    const arc = arcHeight * 4 * t * (1 - t);
    const scale = 1 + 0.15 * Math.sin(t * Math.PI);
    el.setAttribute('transform', `translate(${cx}, ${cy - arc}) scale(${scale})`);
    if (t < 1) requestAnimationFrame(frame);
    else el.setAttribute('transform', `translate(${toX}, ${toY})`);
  }
  el.setAttribute('transform', `translate(${fromX}, ${fromY})`);
  requestAnimationFrame(frame);
}

function animateBounce(el, fromX, fromY, toX, toY, duration) {
  const dx = fromX - toX;
  const dy = fromY - toY;
  const startTime = performance.now();

  function frame(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = bounceEase(t);
    const ox = dx * (1 - ease);
    const oy = dy * (1 - ease);
    el.setAttribute('transform', `translate(${ox}, ${oy})`);
    if (t < 1) requestAnimationFrame(frame);
    else el.setAttribute('transform', 'translate(0, 0)');
  }
  el.setAttribute('transform', `translate(${dx}, ${dy})`);
  requestAnimationFrame(frame);
}

function animateBounceG(el, fromX, fromY, toX, toY, duration) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const startTime = performance.now();

  function frame(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = bounceEase(t);
    const cx = fromX + dx * ease;
    const cy = fromY + dy * ease;
    el.setAttribute('transform', `translate(${cx}, ${cy})`);
    if (t < 1) requestAnimationFrame(frame);
    else el.setAttribute('transform', `translate(${toX}, ${toY})`);
  }
  el.setAttribute('transform', `translate(${fromX}, ${fromY})`);
  requestAnimationFrame(frame);
}

function bounceEase(t) {
  if (t < 0.6) {
    const p = t / 0.6;
    return p * p;
  }
  const p = (t - 0.6) / 0.4;
  return 1 + Math.sin(p * Math.PI) * 0.15 * (1 - p);
}

function animateWarp(realEl, ghostEl, isColored, fromX, fromY, toX, toY, duration) {
  const startTime = performance.now();
  const half = duration * 0.5;
  const pieceSize = isColored ? null : parseFloat(realEl.getAttribute('width') || '45');
  const halfSize = pieceSize ? pieceSize * 0.45 : 0;

  realEl.setAttribute('opacity', '0');
  ghostEl.setAttribute('opacity', '1');

  function frame(now) {
    const elapsed = now - startTime;
    if (elapsed < half) {
      const t = Math.min(elapsed / half, 1);
      const scale = 1 - t * 0.5;
      const opacity = 1 - t;
      ghostEl.setAttribute('opacity', opacity);
      if (isColored) {
        ghostEl.setAttribute('transform', `translate(${fromX}, ${fromY}) scale(${scale})`);
      } else {
        const ox = fromX + halfSize * (1 - scale);
        const oy = fromY + halfSize * (1 - scale);
        ghostEl.setAttribute('x', ox);
        ghostEl.setAttribute('y', oy);
        ghostEl.setAttribute('width', pieceSize * scale);
        ghostEl.setAttribute('height', pieceSize * scale);
      }
    } else {
      if (ghostEl.parentNode) ghostEl.remove();
      const t = Math.min((elapsed - half) / half, 1);
      const scale = 0.5 + t * 0.5;
      realEl.setAttribute('opacity', t);
      if (isColored) {
        realEl.setAttribute('transform', `translate(${toX}, ${toY}) scale(${scale})`);
      } else {
        const ox = toX + halfSize * (1 - scale);
        const oy = toY + halfSize * (1 - scale);
        realEl.setAttribute('x', ox);
        realEl.setAttribute('y', oy);
        realEl.setAttribute('width', pieceSize * scale);
        realEl.setAttribute('height', pieceSize * scale);
      }
      if (t >= 1) {
        realEl.setAttribute('opacity', '1');
        if (isColored) {
          realEl.setAttribute('transform', `translate(${toX}, ${toY})`);
        } else {
          realEl.setAttribute('x', toX);
          realEl.setAttribute('y', toY);
          realEl.setAttribute('width', pieceSize);
          realEl.setAttribute('height', pieceSize);
          realEl.removeAttribute('transform');
        }
        return;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function captureBurst(svg, cx, cy, tileSize) {
  const flash = svgEl('g', { style: 'pointer-events:none' });

  const ring = svgEl('circle', { cx, cy, r: tileSize * 0.15,
    fill: 'none', stroke: 'rgba(255,100,40,0.95)', 'stroke-width': 3 });
  flash.appendChild(ring);

  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    flash.appendChild(svgEl('circle', {
      cx: cx + Math.cos(angle) * tileSize * 0.1,
      cy: cy + Math.sin(angle) * tileSize * 0.1,
      r: 2.5, fill: 'rgba(255,220,60,0.95)'
    }));
  }

  const innerFlash = svgEl('circle', { cx, cy, r: tileSize * 0.3,
    fill: 'rgba(255,200,80,0.4)' });
  flash.appendChild(innerFlash);

  svg.appendChild(flash);

  const start = performance.now();
  const FLASH_DURATION = 400;
  function frameFlash(now) {
    const t = Math.min((now - start) / FLASH_DURATION, 1);
    const ease = 1 - Math.pow(1 - t, 3);

    ring.setAttribute('r', tileSize * 0.15 + ease * tileSize * 0.6);
    ring.setAttribute('stroke-opacity', 1 - ease);
    ring.setAttribute('stroke-width', 3 * (1 - ease * 0.7));

    innerFlash.setAttribute('r', tileSize * 0.3 * (1 - ease));
    innerFlash.setAttribute('opacity', 1 - ease);

    const particles = flash.querySelectorAll('circle:not(:first-child):not(:last-child)');
    particles.forEach((p, i) => {
      const angle = (i / particleCount) * Math.PI * 2;
      const dist = tileSize * 0.1 + ease * tileSize * 0.55;
      p.setAttribute('cx', cx + Math.cos(angle) * dist);
      p.setAttribute('cy', cy + Math.sin(angle) * dist);
      p.setAttribute('opacity', 1 - ease * ease);
      p.setAttribute('r', 2.5 * (1 - ease * 0.5));
    });

    if (t < 1) requestAnimationFrame(frameFlash);
    else flash.remove();
  }
  requestAnimationFrame(frameFlash);
}

Object.assign(MCE, { renderBoard, captureBurst, setTheme, getTheme, THEMES, setPieceStyle, getPieceStyle, PIECE_STYLES, DARK_THEMES });

export { renderBoard, captureBurst, setTheme, getTheme, THEMES, setPieceStyle, getPieceStyle, PIECE_STYLES, DARK_THEMES };
