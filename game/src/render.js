// Drawing only: the engine's state and the current screen in, pixels out. The
// 1280x720 table is scaled to fit the window and centred, the margin filled with
// the backdrop colour. Everything is flat vector shapes and canvas text — no
// images, no fonts to load, no network. The renderer also owns the layout: the
// rects it computes for hands, tables, heroes and buttons are the same rects the
// input layer hit-tests, so a click never lands somewhere the drawing did not put
// a thing.
//
// A note on the art: each element has a vector glyph (flame, drop, leaf, swirl)
// drawn from paths, and each card has an icon drawn from a small set of shapes
// (fang, shell, wing, crown and friends). They are simple on purpose: at card
// size they read instantly, and they render identically in every browser.

import {
  CAMPAIGN_ROUNDS, ELEMENT_INFO, FIELD, FONT, HERO_HP, LAYOUT, PALETTE,
} from './config.js';
import { ACHIEVEMENTS, ELEMENT_COMBOS, PAIR_COMBOS, CARD_LORE, CARDS, PLAYER_DECK, cardById } from './cards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_MAP = 'map';
export const SCREEN_DUEL = 'duel';
export const SCREEN_ROUNDWIN = 'roundwin';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';
export const SCREEN_HOWTO = 'howto';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_COLLECTION = 'collection';

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 0, h: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.w = FIELD.width * view.scale;
    view.h = FIELD.height * view.scale;
    view.x = (width - view.w) / 2;
    view.y = (height - view.h) / 2;
  }

  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', bold = false, baseline = 'alphabetic') {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(value, x, y);
  }

  /** Wrap `value` to lines of at most `maxWidth` at `size`, at most `maxLines`. */
  function wrapText(value, maxWidth, size, maxLines) {
    ctx.font = font(size, false);
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line === '' ? word : `${line} ${word}`;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line !== '') lines.push(line);
        line = word;
      }
      if (lines.length >= maxLines) break;
    }
    if (line !== '' && lines.length < maxLines) lines.push(line);
    return lines;
  }

  // ---- Element glyphs, drawn from paths --------------------------------------

  function drawGlyph(kind, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size / 12);
    ctx.lineJoin = 'round';
    const s = size / 2;
    if (kind === 'flame') {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.7, s * 0.5, 0, s);
      ctx.bezierCurveTo(-s * 0.7, s * 0.5, -s * 0.9, -s * 0.2, 0, -s);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.bezierCurveTo(s * 0.4, s * 0.2, s * 0.3, s * 0.6, 0, s * 0.75);
      ctx.bezierCurveTo(-s * 0.3, s * 0.6, -s * 0.4, s * 0.2, 0, -s * 0.2);
      ctx.fill();
    } else if (kind === 'drop') {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.85, -s * 0.1, s * 0.8, s * 0.55, 0, s);
      ctx.bezierCurveTo(-s * 0.8, s * 0.55, -s * 0.85, -s * 0.1, 0, -s);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.3, s * 0.25, s * 0.18, s * 0.3, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'leaf') {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s, -s * 0.4, s * 0.8, s * 0.7, 0, s);
      ctx.bezierCurveTo(-s * 0.8, s * 0.7, -s, -s * 0.4, 0, -s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(0, s * 0.9);
      ctx.stroke();
    } else if (kind === 'swirl') {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 3.4; a += 0.2) {
        const r = (a / (Math.PI * 3.4)) * s;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.55, -s * 0.5);
      ctx.lineTo(s * 0.95, -s * 0.25);
      ctx.lineTo(s * 0.5, -s * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Card icons: one small vector picture per card --------------------------
  // Each icon is drawn in the art band with the element colour behind it. The
  // shapes are deliberately simple — a tooth, a shell, a wing — so they read at
  // 60 pixels and stay honest at 200.

  function drawIcon(icon, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size / 14);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const s = size / 2;
    switch (icon) {
      case 'imp':
      case 'pup':
      case 'hound':
      case 'wolf':
        // A fang.
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, -s * 0.6);
        ctx.quadraticCurveTo(0, -s * 1.1, s * 0.7, -s * 0.6);
        ctx.quadraticCurveTo(s * 0.3, s * 0.2, 0, s);
        ctx.quadraticCurveTo(-s * 0.3, s * 0.2, -s * 0.7, -s * 0.6);
        ctx.fill();
        break;
      case 'phoenix':
      case 'dragon':
      case 'hawk':
      case 'griffin':
      case 'sparrow':
        // A wing.
        ctx.beginPath();
        ctx.moveTo(-s, s * 0.6);
        ctx.quadraticCurveTo(-s * 0.4, -s, s * 0.8, -s * 0.7);
        ctx.quadraticCurveTo(s * 0.2, -s * 0.1, s * 0.5, s * 0.3);
        ctx.quadraticCurveTo(0, s * 0.1, -s * 0.2, s * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      case 'crab':
      case 'turtle':
      case 'golem':
      case 'oak':
      case 'bear':
        // A shell / shield.
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.85, -s * 0.3);
        ctx.lineTo(s * 0.6, s * 0.7);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.6, s * 0.7);
        ctx.lineTo(-s * 0.85, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.7);
        ctx.lineTo(0, s * 0.7);
        ctx.stroke();
        break;
      case 'salamander':
      case 'serpent':
      case 'vine':
      case 'storm':
        // A coil.
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2.4; a += 0.25) {
          const r = s * (0.25 + (a / (Math.PI * 2.4)) * 0.6);
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r * 0.8;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      case 'siren':
      case 'dryad':
      case 'djinn':
        // A crown.
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, s * 0.6);
        ctx.lineTo(-s * 0.8, -s * 0.2);
        ctx.lineTo(-s * 0.35, s * 0.15);
        ctx.lineTo(0, -s * 0.7);
        ctx.lineTo(s * 0.35, s * 0.15);
        ctx.lineTo(s * 0.8, -s * 0.2);
        ctx.lineTo(s * 0.8, s * 0.6);
        ctx.closePath();
        ctx.fill();
        break;
      case 'droplet':
      case 'otter':
      case 'leviathan':
        drawGlyph('drop', 0, 0, size, color);
        break;
      case 'sprout':
      case 'wisp':
      case 'bloom':
      case 'regrowth':
        drawGlyph('leaf', 0, 0, size, color);
        break;
      case 'zephyr':
      case 'cloud':
      case 'gust':
      case 'cyclone':
        drawGlyph('swirl', 0, 0, size, color);
        break;
      default:
        // Fireball, kindle, surge, mend, frost, thorns, swift, immolate:
        // a four-point star.
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.25, -s * 0.25, s, 0);
        ctx.quadraticCurveTo(s * 0.25, s * 0.25, 0, s);
        ctx.quadraticCurveTo(-s * 0.25, s * 0.25, -s, 0);
        ctx.quadraticCurveTo(-s * 0.25, -s * 0.25, 0, -s);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  // ---- Layout: the rects the input layer hit-tests ----------------------------

  /**
   * Compute every clickable rect for the current state. The renderer and the
   * input layer share this, so a click always means what the drawing shows.
   */
  function computeLayout(engineState) {
    const layout = {
      handCards: [], // {uid, x, y, w, h, card}
      playerMinions: [], // {uid, x, y, w, h}
      aiMinions: [],
      playerHero: null, aiHero: null,
      endTurn: null, buttons: [],
    };
    const duel = engineState.duel;
    if (!duel) return layout;
    // Player hand: fanned from handX0, cards overlap slightly when there are 7.
    const hand = duel.player.hand;
    const gap = hand.length > 5 ? 6 : LAYOUT.handGap;
    const totalW = hand.length * LAYOUT.handW + (hand.length - 1) * gap;
    const startX = Math.min(LAYOUT.handX0, (FIELD.width - totalW) / 2 + 60);
    hand.forEach((handCard, i) => {
      const raised = duel.selection.handUid === handCard.uid;
      layout.handCards.push({
        uid: handCard.uid, card: cardById(handCard.cardId),
        x: startX + i * (LAYOUT.handW + gap),
        y: LAYOUT.handY - (raised ? 18 : 0),
        w: LAYOUT.handW, h: LAYOUT.handH,
      });
    });
    // Table rows: centred, cards spaced across the middle of the table.
    const rowCardW = 104;
    const rowCardH = 148;
    function rowRects(table, y) {
      const rects = [];
      const total = table.length * rowCardW + Math.max(0, table.length - 1) * 14;
      let x = (FIELD.width - total) / 2;
      for (const minion of table) {
        rects.push({ uid: minion.uid, x, y, w: rowCardW, h: rowCardH });
        x += rowCardW + 14;
      }
      return rects;
    }
    layout.playerMinions = rowRects(duel.player.table, LAYOUT.playerRowY);
    layout.aiMinions = rowRects(duel.ai.table, LAYOUT.rivalRowY);
    layout.playerHero = { x: LAYOUT.playerHero.x, y: LAYOUT.playerHero.y, w: LAYOUT.playerHero.w, h: LAYOUT.playerHero.h };
    layout.aiHero = { x: 16, y: 16, w: LAYOUT.heroW, h: LAYOUT.heroH };
    layout.endTurn = { ...LAYOUT.endTurn };
    return layout;
  }
  // ---- Cards -------------------------------------------------------------------

  /** Draw one card face at (x, y, w, h). `opts` marks selection, playability, glow. */
  function drawCardFace(x, y, w, h, card, opts = {}) {
    const info = ELEMENT_INFO[card.element];
    const playable = opts.playable !== false;
    const selected = opts.selected === true;
    const canAttack = opts.canAttack === true;
    const frozen = opts.frozen === true;
    const atk = opts.atk ?? card.atk;
    const hp = opts.hp ?? card.hp;

    ctx.save();
    if (selected) ctx.translate(0, -6);
    if (canAttack) {
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 18;
    } else if (selected) {
      ctx.shadowColor = info.color;
      ctx.shadowBlur = 14;
    }
    // Face.
    rr(ctx, x, y, w, h, 9);
    ctx.fillStyle = playable ? '#f7f2e8' : '#cfc8bd';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? PALETTE.gold : '#8a7f6d';
    ctx.stroke();
    // Element band.
    rr(ctx, x + 3, y + 3, w - 6, 20, 6);
    ctx.fillStyle = info.color;
    ctx.fill();
    text(info.name.toUpperCase(), x + w / 2, y + 18, 11, '#ffffff', 'center', true);
    // Cost gem.
    circle(ctx, x + 14, y + 14, 12);
    ctx.fillStyle = '#2b6cb0';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    text(String(card.cost), x + 14, y + 19, 14, '#ffffff', 'center', true);
    // Art band.
    const artY = y + 26;
    const artH = 56;
    rr(ctx, x + 6, artY, w - 12, artH, 6);
    ctx.fillStyle = info.dark;
    ctx.fill();
    drawGlyph(info.glyph, x + w / 2, artY + artH / 2, 24, info.light);
    drawIcon(card.icon, x + w / 2, artY + artH / 2, 40, '#ffffff');
    // Name.
    text(card.name, x + w / 2, artY + artH + 14, 11, '#241d38', 'center', true);
    // Rules text: at most two lines, kept clear of the pips at the corners.
    const lines = wrapText(card.text, w - 30, 9, 2);
    lines.forEach((line, i) => {
      text(line, x + w / 2, artY + artH + 28 + i * 11, 9, '#4a4266', 'center');
    });
    if (card.taunt) {
      // A gold T badge at the top right: the guard you must answer first.
      circle(ctx, x + w - 15, y + 15, 10);
      ctx.fillStyle = PALETTE.gold;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7a5c00';
      ctx.stroke();
      text('T', x + w - 15, y + 19, 12, '#241d38', 'center', true);
    }
    // Attack / health pips, minions only.
    if (card.kind === 'minion') {
      circle(ctx, x + 15, y + h - 14, 12);
      ctx.fillStyle = '#c0392b';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      text(String(atk), x + 15, y + h - 9, 13, '#ffffff', 'center', true);
      circle(ctx, x + w - 15, y + h - 14, 12);
      ctx.fillStyle = '#2e7d32';
      ctx.fill();
      ctx.stroke();
      text(String(hp), x + w - 15, y + h - 9, 13, '#ffffff', 'center', true);
    } else {
      text('SPELL', x + w / 2, y + h - 12, 9, '#5b4a8a', 'center', true);
    }
    if (frozen) {
      rr(ctx, x, y, w, h, 9);
      ctx.fillStyle = 'rgba(120,180,255,0.45)';
      ctx.fill();
      text('FROZEN', x + w / 2, y + h / 2, 12, '#ffffff', 'center', true);
    }
    if (!playable && card.kind === 'minion') {
      rr(ctx, x, y, w, h, 9);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
    }
    ctx.restore();
  }

  /** Draw a card face at a smaller scale, reusing the exact full-size layout. */
  function drawCardFaceScaled(x, y, scale, card, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawCardFace(0, 0, 104, 148, card, opts);
    ctx.restore();
  }

  /** A face-down card back, for the rival's hand. */
  function drawCardBack(x, y, w, h) {
    rr(ctx, x, y, w, h, 5);
    ctx.fillStyle = '#3d2f6e';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.gold;
    ctx.stroke();
    drawGlyph('flame', x + w / 2, y + h / 2, Math.min(w, h) * 0.5, PALETTE.gold);
  }

  // ---- Heroes, mana, log ---------------------------------------------------------

  function drawHeroBlock(x, y, w, h, side, hero, selected, extra) {
    const info = ELEMENT_INFO[hero.element];
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? PALETTE.gold : PALETTE.panelEdge;
    ctx.stroke();
    // Portrait: element colour disc with the glyph.
    circle(ctx, x + 34, y + h / 2, 26);
    ctx.fillStyle = info.color;
    ctx.fill();
    drawGlyph(info.glyph, x + 34, y + h / 2, 30, '#ffffff');
    text(hero.name, x + 70, y + 26, 17, PALETTE.text, 'left', true);
    text(hero.title, x + 70, y + 46, 11, PALETTE.muted, 'left');
    // Life bar.
    const barX = x + 70;
    const barY = y + 56;
    const barW = w - 86;
    rr(ctx, barX, barY, barW, 16, 8);
    ctx.fillStyle = '#3a2f4e';
    ctx.fill();
    const hpFrac = Math.max(0, hero.hp / hero.maxHp);
    if (hpFrac > 0) {
      rr(ctx, barX, barY, barW * hpFrac, 16, 8);
      ctx.fillStyle = PALETTE.hp;
      ctx.fill();
    }
    text(`${hero.hp} / ${hero.maxHp}`, barX + barW / 2, barY + 13, 11, '#ffffff', 'center', true);
    if (hero.armor > 0) {
      text(`+${hero.armor} armor`, barX + barW, barY + 32, 11, PALETTE.armor, 'right', true);
    }
    // Mana pips and the deck/turn line live inside the hero block, where the
    // hand can never cover them. `extra` is {mana, maxMana, deck, turn}.
    if (extra) {
      const manaY = barY + 28;
      text('Mana', barX, manaY + 5, 11, PALETTE.muted, 'left', true);
      for (let i = 0; i < extra.maxMana; i += 1) {
        const cx = barX + 42 + i * 14;
        circle(ctx, cx, manaY, 5.5);
        ctx.fillStyle = i < extra.mana ? PALETTE.mana : '#3a2f4e';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      text(`${extra.mana}/${extra.maxMana}`, barX + 42 + extra.maxMana * 14 + 6, manaY + 5, 11, PALETTE.text, 'left', true);
      if (extra.deck !== undefined) {
        text(`Deck ${extra.deck} cards · Turn ${extra.turn}`, barX, manaY + 24, 11, PALETTE.muted, 'left');
      }
    }
  }

  function drawMana(x, y, maxMana, mana, label) {
    text(label, x, y + 12, 12, PALETTE.muted, 'left', true);
    // Start the pips after the label, measured, so they never print over it.
    ctx.font = font(12, true);
    const labelW = ctx.measureText(label).width;
    const startX = x + labelW + 10;
    for (let i = 0; i < maxMana; i += 1) {
      const cx = startX + i * 20;
      circle(ctx, cx, y + 7, 8);
      ctx.fillStyle = i < mana ? PALETTE.mana : '#3a2f4e';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    text(`${mana}/${maxMana}`, startX + maxMana * 20 + 8, y + 12, 12, PALETTE.text, 'left', true);
  }

  function drawLog(duel) {
    const lines = duel.log.slice(-LAYOUT.logLines);
    text('— Battle log —', LAYOUT.logX, LAYOUT.logY, 11, PALETTE.dim, 'left', true);
    lines.forEach((line, i) => {
      const alpha = 0.45 + (0.55 * (i + 1)) / lines.length;
      ctx.globalAlpha = alpha;
      const clipped = line.length > 62 ? `${line.slice(0, 61)}…` : line;
      text(clipped, LAYOUT.logX, LAYOUT.logY + 18 + i * 15, 11, PALETTE.muted, 'left');
      ctx.globalAlpha = 1;
    });
  }

  // ---- Combat animation: a lunge toward the target, a ring on summon --------
  // The engine reports attacks and summons as events; main.js keeps them in
  // ui.anims with a birth time, and this turns them into a pixel offset that
  // fades over a third of a second. Pure presentation: the rules never see it.

  function animTargetPoint(target, layout) {
    if (target.kind === 'hero') {
      const r = target.side === 'player' ? layout.playerHero : layout.aiHero;
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    const rects = target.side === 'player' ? layout.playerMinions : layout.aiMinions;
    const r = rects.find((x) => x.uid === target.uid);
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  }

  function minionAnim(rect, uid, side, layout, ui) {
    const out = { dx: 0, dy: 0, flash: false };
    if (!ui.anims) return out;
    const now = performance.now();
    for (const a of ui.anims) {
      if (a.kind === 'attack' && a.attackerUid === uid && a.side === side) {
        const age = (now - a.born) / 1000;
        if (age >= 0.35) continue;
        const point = animTargetPoint(a.target, layout);
        if (!point) continue;
        const fromX = rect.x + rect.w / 2;
        const fromY = rect.y + rect.h / 2;
        const dist = Math.hypot(point.x - fromX, point.y - fromY) || 1;
        const lunge = Math.sin((age / 0.35) * Math.PI) * 16;
        out.dx += ((point.x - fromX) / dist) * lunge;
        out.dy += ((point.y - fromY) / dist) * lunge;
      } else if (a.kind === 'summon' && a.minionUid === uid && a.side === side) {
        const age = (now - a.born) / 1000;
        if (age >= 0.4) continue;
        out.dy -= (1 - age / 0.4) * 22;
        out.flash = true;
      }
    }
    return out;
  }

  function drawSummonRing(rect) {
    ctx.save();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    rr(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, 12);
    ctx.stroke();
    ctx.restore();
  }

  // ---- The duel table ------------------------------------------------------------

  function drawDuel(engineState, ui) {
    const duel = engineState.duel;
    const layout = computeLayout(engineState);
    // Table.
    rr(ctx, 8, 122, FIELD.width - 16, 524, 14);
    ctx.fillStyle = PALETTE.felt;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.feltEdge;
    ctx.stroke();
    ctx.save();
    ctx.strokeStyle = PALETTE.tableLine;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(24, 272);
    ctx.lineTo(FIELD.width - 24, 272);
    ctx.stroke();
    ctx.restore();
    text('RIVAL', 24, 142, 11, PALETTE.dim, 'left', true);
    text('YOUR TABLE', 24, 412, 11, PALETTE.dim, 'left', true);

    // Rival hero + hand + deck.
    drawHeroBlock(layout.aiHero.x, layout.aiHero.y, layout.aiHero.w, layout.aiHero.h, 'ai', duel.ai, false);
    drawMana(286, 26, duel.ai.maxMana, duel.ai.mana, 'Rival mana');
    const rivalHand = duel.ai.hand.length;
    for (let i = 0; i < rivalHand; i += 1) {
      drawCardBack(760 + i * (LAYOUT.rivalCardW + LAYOUT.rivalCardGap), LAYOUT.rivalHandY, LAYOUT.rivalCardW, LAYOUT.rivalCardH);
    }
    text(`Deck ${duel.ai.deck.length}`, 760, 92, 11, PALETTE.muted, 'left');

    // Rival minions. An attack lunges toward its target; a summon pops in.
    layout.aiMinions.forEach((rect) => {
      const minion = duel.ai.table.find((m) => m.uid === rect.uid);
      const card = cardById(minion.cardId);
      const targetable = duel.selection.attackerUid !== null || duel.selection.pendingTarget === 'enemy-minion' || duel.selection.pendingTarget === 'any';
      const anim = minionAnim(rect, minion.uid, 'ai', layout, ui);
      ctx.save();
      ctx.translate(anim.dx, anim.dy);
      drawCardFace(rect.x, rect.y, rect.w, rect.h, card, {
        atk: minion.atk + minion.tempAtk, hp: minion.hp,
        frozen: minion.frozenTurns > 0, canAttack: targetable,
      });
      ctx.restore();
      if (anim.flash) drawSummonRing(rect);
    });
    // Player minions.
    layout.playerMinions.forEach((rect) => {
      const minion = duel.player.table.find((m) => m.uid === rect.uid);
      const card = cardById(minion.cardId);
      const anim = minionAnim(rect, minion.uid, 'player', layout, ui);
      ctx.save();
      ctx.translate(anim.dx, anim.dy);
      drawCardFace(rect.x, rect.y, rect.w, rect.h, card, {
        atk: minion.atk + minion.tempAtk, hp: minion.hp,
        frozen: minion.frozenTurns > 0,
        canAttack: minion.canAttack && duel.turn === 'player',
        selected: duel.selection.attackerUid === minion.uid,
      });
      ctx.restore();
      if (anim.flash) drawSummonRing(rect);
    });

    // Player hero + mana + deck. Mana lives inside the hero block now, where
    // the hand can never cover it.
    drawHeroBlock(layout.playerHero.x, layout.playerHero.y, layout.playerHero.w, layout.playerHero.h, 'player', duel.player, false, {
      mana: duel.player.mana, maxMana: duel.player.maxMana, deck: duel.player.deck.length, turn: duel.turnNumber,
    });
    // Turn indicator: centred in the middle band, clear of the log and the
    // button; hidden while a targeting hint is showing in the same spot.
    // A demo duel says so, so nobody mistakes it for a real match.
    if (engineState.mode === 'demo') {
      text('DEMO DUEL — the engine plays both sides · click anywhere to stop', 640, 292, 13, PALETTE.gold, 'center', true);
    } else if (!duel.selection.pendingTarget && duel.selection.attackerUid === null) {
      if (duel.turn === 'player') {
        text('YOUR TURN — play a card or attack', 640, 292, 13, PALETTE.gold, 'center', true);
      } else {
        text(`${duel.ai.name} is playing…`, 640, 292, 13, PALETTE.muted, 'center', true);
      }
    }

    // Player hand.
    layout.handCards.forEach((rect) => {
      const affordable = duel.player.mana >= rect.card.cost;
      drawCardFace(rect.x, rect.y, rect.w, rect.h, rect.card, {
        playable: duel.turn === 'player' && affordable,
        selected: duel.selection.handUid === rect.uid,
      });
    });
    if (duel.player.hand.length === 0) {
      text('Your hand is empty — end the turn to draw.', 700, 640, 13, PALETTE.muted, 'center');
    }

    // End Turn button.
    const et = layout.endTurn;
    const canEnd = duel.turn === 'player' && !duel.over;
    rr(ctx, et.x, et.y, et.w, et.h, 10);
    ctx.fillStyle = canEnd ? PALETTE.button : '#2c2447';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = canEnd ? PALETTE.buttonEdge : PALETTE.dim;
    ctx.stroke();
    text('END TURN', et.x + et.w / 2, et.y + 25, 15, canEnd ? '#ffffff' : PALETTE.dim, 'center', true);
    text('Space', et.x + et.w / 2, et.y + 42, 10, canEnd ? PALETTE.muted : PALETTE.dim, 'center');

    // Surrender, small and out of the way, under the End Turn button.
    const sr = { x: et.x, y: et.y + 62, w: et.w, h: 32 };
    rr(ctx, sr.x, sr.y, sr.w, sr.h, 8);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.danger;
    ctx.stroke();
    text('SURRENDER', sr.x + sr.w / 2, sr.y + 21, 11, PALETTE.danger, 'center', true);
    layout.surrender = sr;

    // Help, top right of the table: the rules, without leaving the duel.
    const help = { x: FIELD.width - 52, y: 128, w: 36, h: 36 };
    circle(ctx, help.x + 18, help.y + 18, 17);
    ctx.fillStyle = PALETTE.button;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.buttonEdge;
    ctx.stroke();
    text('?', help.x + 18, help.y + 25, 18, '#ffffff', 'center', true);
    layout.help = help;

    drawLog(duel);

    // Targeting hint.
    if (duel.selection.pendingTarget) {
      const need = duel.selection.pendingTarget;
      const hint = need === 'friendly-minion'
        ? 'Choose one of YOUR minions'
        : need === 'enemy-minion' ? 'Choose an ENEMY minion' : 'Choose a target — hero or minion';
      text(hint, FIELD.width / 2, 300, 15, PALETTE.gold, 'center', true);
      text('Right-click or Esc to cancel', FIELD.width / 2, 320, 11, PALETTE.muted, 'center');
    } else if (duel.selection.attackerUid !== null) {
      text('Choose a target to attack', FIELD.width / 2, 300, 15, PALETTE.gold, 'center', true);
    }

    // AI tell banner.
    if (ui.tell && ui.tellUntil > performance.now()) {
      const alpha = Math.min(1, (ui.tellUntil - performance.now()) / 400);
      ctx.globalAlpha = alpha;
      rr(ctx, 300, 286, 680, 40, 8);
      ctx.fillStyle = 'rgba(61,47,110,0.95)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PALETTE.buttonEdge;
      ctx.stroke();
      text(ui.tell, 640, 311, 14, '#ffffff', 'center', true);
      ctx.globalAlpha = 1;
    }

    // Combo / banner announcements.
    if (ui.banner && ui.bannerUntil > performance.now()) {
      const alpha = Math.min(1, (ui.bannerUntil - performance.now()) / 400);
      ctx.globalAlpha = alpha;
      const bw = 640;
      rr(ctx, (FIELD.width - bw) / 2, 210, bw, 76, 12);
      ctx.fillStyle = 'rgba(20,12,36,0.92)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.gold;
      ctx.stroke();
      text(ui.banner.text, FIELD.width / 2, 242, 24, PALETTE.gold, 'center', true);
      if (ui.banner.sub) text(ui.banner.sub, FIELD.width / 2, 268, 13, PALETTE.text, 'center');
      ctx.globalAlpha = 1;
    }

    // Floating numbers.
    for (const f of ui.floats) {
      const age = (performance.now() - f.born) / 1000;
      if (age > 1.1) continue;
      const alpha = 1 - age / 1.1;
      ctx.globalAlpha = alpha;
      text(f.text, f.x, f.y - age * 46, 20, f.color, 'center', true);
      ctx.globalAlpha = 1;
    }

    // The mulligan: before the first turn, the opening hand is offered back.
    if (duel.mulligan && duel.mulligan.active) {
      ctx.fillStyle = 'rgba(10,6,20,0.78)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      const px = 190;
      const py = 130;
      const pw = 900;
      const ph = 430;
      rr(ctx, px, py, pw, ph, 16);
      ctx.fillStyle = PALETTE.panel;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.gold;
      ctx.stroke();
      text('MULLIGAN', FIELD.width / 2, py + 52, 36, PALETTE.text, 'center', true);
      text('Your opening hand. Click cards to send them back, then confirm.', FIELD.width / 2, py + 86, 15, PALETTE.muted, 'center');
      text('The rival already chose theirs. A fresh draw costs nothing — but you only get one.', FIELD.width / 2, py + 108, 13, PALETTE.dim, 'center');
      const hand = duel.player.hand;
      const totalW = hand.length * 104 + (hand.length - 1) * 14;
      let hx = (FIELD.width - totalW) / 2;
      ui.mulligan = { cards: [], redraw: null, keep: null };
      hand.forEach((handCard) => {
        const card = cardById(handCard.cardId);
        const marked = duel.mulligan.selected.has(handCard.uid);
        drawCardFace(hx, py + 140, 104, 148, card, { selected: marked });
        if (marked) {
          text('REDRAW', hx + 52, py + 140 + 74, 13, '#ffffff', 'center', true);
        }
        ui.mulligan.cards.push({ uid: handCard.uid, x: hx, y: py + 140, w: 104, h: 148 });
        hx += 104 + 14;
      });
      const markedCount = duel.mulligan.selected.size;
      ui.mulligan.redraw = { x: FIELD.width / 2 - 260, y: py + 320, w: 250, h: 56 };
      ui.mulligan.keep = { x: FIELD.width / 2 + 10, y: py + 320, w: 250, h: 56 };
      drawButton(ui.mulligan.redraw, markedCount > 0 ? `REDRAW ${markedCount}` : 'REDRAW NONE', 'draw replacements', true);
      drawButton(ui.mulligan.keep, 'KEEP ALL', 'start the duel', true);
    }


    return layout;
  }

  // ---- Screens -------------------------------------------------------------------

  function drawPanel(x, y, w, h, title, lines, prompt, titleSize = 40) {
    rr(ctx, x, y, w, h, 14);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    text(title, FIELD.width / 2, y + titleSize + 28, titleSize, PALETTE.text, 'center', true);
    lines.forEach((line, i) => {
      text(line, FIELD.width / 2, y + titleSize + 72 + i * 26, 16, PALETTE.muted, 'center');
    });
    if (prompt) text(prompt, FIELD.width / 2, y + h - 30, 16, PALETTE.gold, 'center');
  }

  function drawButton(rect, label, sub, enabled = true) {
    rr(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fillStyle = enabled ? PALETTE.button : '#2c2447';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = enabled ? PALETTE.buttonEdge : PALETTE.dim;
    ctx.stroke();
    text(label, rect.x + rect.w / 2, rect.y + 26, 16, enabled ? '#ffffff' : PALETTE.dim, 'center', true);
    if (sub) text(sub, rect.x + rect.w / 2, rect.y + 46, 11, PALETTE.muted, 'center');
  }

  function drawTitle(engineState, ui) {
    // A court of the four elements in a row above the title, clear of the letters.
    const cx = FIELD.width / 2;
    const glyphX = [cx - 300, cx - 100, cx + 100, cx + 300];
    ['ember', 'tide', 'thorn', 'gale'].forEach((el, i) => {
      const info = ELEMENT_INFO[el];
      drawGlyph(info.glyph, glyphX[i], 92, 46, info.color);
    });
    text('EMBER COURT', cx, 170, 64, PALETTE.text, 'center', true);
    text('40 Cards  ·  12 Combos  ·  5 Rounds  ·  1 Crown', cx, 208, 19, PALETTE.gold, 'center', true);
    text('A duel card battler. Outplay the five courts, take the Crown.', cx, 238, 15, PALETTE.muted, 'center');
    drawButton({ x: cx - 260, y: 300, w: 240, h: 64 }, 'START CAMPAIGN', '5 rounds, 1 crown', true);
    drawButton({ x: cx + 20, y: 300, w: 240, h: 64 }, 'QUICK DUEL', 'one match, any rival', true);
    drawButton({ x: cx - 360, y: 384, w: 220, h: 56 }, 'HOW TO PLAY', 'rules, elements & combos', true);
    drawButton({ x: cx - 110, y: 384, w: 220, h: 56 }, 'COLLECTION', '40 cards & their lore', true);
    drawButton({ x: cx + 140, y: 384, w: 220, h: 56 }, 'WATCH A DUEL', 'the engine plays itself', true);
    if (engineState.best > 0) {
      text(`Best campaign: ${engineState.best} of 5 rounds won`, cx, 470, 14, PALETTE.muted, 'center');
    }
    // Court records: the last few duels, and the running tally.
    const history = engineState.history ?? [];
    if (history.length > 0) {
      const wins = history.filter((h) => h.result === 'W').length;
      text(`Court records — ${wins}W / ${history.length - wins}L in your last ${history.length} duels`, cx, 500, 13, PALETTE.muted, 'center');
      history.slice(-3).reverse().forEach((h, i) => {
        const mark = h.result === 'W' ? 'Won' : 'Lost';
        text(`${mark} vs ${h.opponent} — Round ${h.round}`, cx, 522 + i * 20, 12, h.result === 'W' ? PALETTE.good : PALETTE.danger, 'center');
      });
    }
    const unlocked = engineState.achievements ?? [];
    if (unlocked.length > 0) {
      const names = unlocked.map((id) => (ACHIEVEMENTS.find((a) => a.id === id) ?? { name: id }).name);
      text(`Achievements: ${names.join(' · ')}`, cx, 592, 12, PALETTE.gold, 'center');
    }
    const lifetime = engineState.lifetime ?? { duels: 0, wins: 0, combos: 0 };
    if (lifetime.duels > 0) {
      text(`Lifetime — ${lifetime.duels} duels, ${lifetime.wins} won, ${lifetime.combos} combos fired`, cx, 616, 12, PALETTE.dim, 'center');
    }
    // Music toggle, bottom right, clear of the footer lines.
    const musicRect = { x: FIELD.width - 150, y: 668, w: 130, h: 32 };
    rr(ctx, musicRect.x, musicRect.y, musicRect.w, musicRect.h, 8);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    text(engineState.musicOn === false ? 'MUSIC: OFF' : 'MUSIC: ON', musicRect.x + musicRect.w / 2, musicRect.y + 21, 11, PALETTE.muted, 'center', true);
    // Session seed, bottom left: the same seed replays the same shuffles.
    if (engineState.seed !== undefined) {
      text(`Session seed ${engineState.seed}`, 20, 692, 11, PALETTE.dim, 'left');
    }
    text('Mouse + keyboard · 1–7 play a card · Space ends the turn · P pauses · M mutes', cx, 640, 13, PALETTE.dim, 'center');
    text('Ember burns Thorn · Thorn chokes Gale · Gale scatters Tide · Tide drowns Ember', cx, 664, 13, PALETTE.dim, 'center');
    ui.titleButtons = {
      campaign: { x: cx - 260, y: 300, w: 240, h: 64 },
      quick: { x: cx + 20, y: 300, w: 240, h: 64 },
      howto: { x: cx - 360, y: 384, w: 220, h: 56 },
      collection: { x: cx - 110, y: 384, w: 220, h: 56 },
      demo: { x: cx + 140, y: 384, w: 220, h: 56 },
      music: musicRect,
    };
  }

  function drawMap(engineState, ui) {
    const cx = FIELD.width / 2;
    text('THE FIVE COURTS', cx, 90, 40, PALETTE.text, 'center', true);
    text(`Round ${engineState.round} of 5 — beat them all to take the Crown`, cx, 122, 15, PALETTE.muted, 'center');
    // (Opponent list is passed in through ui.opponents by main.js.)
    const opponents = ui.opponents;
    // Path line.
    ctx.save();
    ctx.strokeStyle = PALETTE.tableLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    LAYOUT.mapNodes.forEach((node, i) => {
      if (i === 0) ctx.moveTo(node.x, node.y);
      else ctx.lineTo(node.x, node.y);
    });
    ctx.stroke();
    ctx.restore();
    opponents.forEach((opp, i) => {
      const node = LAYOUT.mapNodes[i];
      const info = ELEMENT_INFO[opp.element === 'mixed' ? 'ember' : opp.element];
      const beaten = i < engineState.campaignWins;
      const current = i === engineState.round - 1;
      circle(ctx, node.x, node.y, current ? 44 : 36);
      ctx.fillStyle = beaten ? '#2e7d32' : current ? info.color : '#3a2f4e';
      ctx.fill();
      ctx.lineWidth = current ? 4 : 2;
      ctx.strokeStyle = current ? PALETTE.gold : PALETTE.panelEdge;
      ctx.stroke();
      drawGlyph(info.glyph, node.x, node.y, 34, '#ffffff');
      text(`${i + 1}. ${opp.name}`, node.x, node.y + 62, 15, beaten ? PALETTE.good : PALETTE.text, 'center', true);
      text(opp.title, node.x, node.y + 82, 11, PALETTE.muted, 'center');
      text(`${HERO_HP + opp.hpBonus} life · ${opp.element === 'mixed' ? 'all elements' : `${opp.element} deck`}`, node.x, node.y + 100, 11, PALETTE.dim, 'center');
      if (beaten) text('DEFEATED', node.x, node.y - 52, 12, PALETTE.good, 'center', true);
      if (current) text('NEXT', node.x, node.y - 52, 12, PALETTE.gold, 'center', true);
    });
    drawButton({ x: cx - 130, y: 600, w: 260, h: 60 }, `FIGHT ${opponents[engineState.round - 1].name.toUpperCase()}`, 'Round ' + engineState.round, true);
    ui.mapButtons = { fight: { x: cx - 130, y: 600, w: 260, h: 60 } };
  }

  function drawHowto(engineState, ui) {
    const cx = FIELD.width / 2;
    text('HOW TO PLAY', cx, 64, 36, PALETTE.text, 'center', true);
    const left = [
      'THE DUEL — First hero to 0 life loses. Each turn you gain',
      '1 mana (up to 10) and draw 1 card. Play minions to the table,',
      'then attack with them the next turn. Minions fight each other',
      'and both take damage. A Taunt minion must be attacked first.',
      '',
      'THE ELEMENTS — Ember burns Thorn, Thorn chokes Gale, Gale',
      'scatters Tide, Tide drowns Ember. An attack with the winning',
      'element deals +2; with the losing element, −1.',
      '',
      'COMBOS — Play 2 cards of one element in a turn to fire its',
      'combo. Play both cards of a named pair in a turn for a bonus.',
    ];
    left.forEach((line, i) => text(line, 60, 110 + i * 20, 14, PALETTE.muted, 'left'));
    // The 12 combos, right column.
    text('THE 12 COMBOS', 700, 110, 16, PALETTE.gold, 'left', true);
    const combos = [...Object.values(ELEMENT_COMBOS), ...PAIR_COMBOS];
    combos.forEach((combo, i) => {
      const y = 136 + i * 22;
      text(combo.name, 700, y, 13, PALETTE.text, 'left', true);
      const short = combo.text.split(':')[1] ?? combo.text;
      text(short.trim(), 830, y, 12, PALETTE.muted, 'left');
    });
    // Tips from the court, under the combos.
    text('TIPS FROM THE COURT', 700, 414, 16, PALETTE.gold, 'left', true);
    const tips = [
      'Spend your mana every turn — unspent mana is a wasted turn.',
      'Trade minions when you are ahead; go for the hero when behind.',
      'Save a removal spell for the rival’s biggest threat.',
      'Two cards of one element is a combo — plan the turn around it.',
      'Taunts guard the hero: clear them before you swing for lethal.',
      'Watch the tell: a heavy card is coming, and you can answer it.',
    ];
    tips.forEach((tip, i) => {
      text(`· ${tip}`, 700, 440 + i * 22, 13, PALETTE.muted, 'left');
    });
    text('KEYS — 1–7 select a hand card · Click a minion, then a target ·', 60, 606, 13, PALETTE.muted, 'left');
    text('Space ends the turn · Right-click / Esc cancels · P pauses · M mutes', 60, 628, 13, PALETTE.muted, 'left');
    drawButton({ x: cx - 120, y: 652, w: 240, h: 52 }, 'BACK', '', true);
    ui.howtoButtons = { back: { x: cx - 120, y: 652, w: 240, h: 52 } };
    // The wheel, drawn under the rules text on the left.
    drawWheel(240, 470, 72);
  }

  function drawEndScreen(engineState, ui, kind) {
    const duel = engineState.duel;
    const stats = duel ? duel.stats : { cardsPlayed: 0, combos: 0, damageDealt: 0, minions: 0, turns: 0 };
    const cx = FIELD.width / 2;
    const isQuick = engineState.mode === 'quick';
    if (kind === 'win' && !isQuick) {
      text('THE CROWN IS YOURS', cx, 120, 52, PALETTE.gold, 'center', true);
      drawGlyph('flame', cx, 190, 64, '#e5534b');
      text('Five courts fell. The Ember Queen bows. You are the Champion of the Court.', cx, 250, 16, PALETTE.text, 'center');
    } else if (kind === 'win') {
      text(`${duel.opponent.name.toUpperCase()} IS BEATEN`, cx, 120, 44, PALETTE.gold, 'center', true);
      text(`You won the quick duel in ${stats.turns} turns. The court applauds.`, cx, 190, 16, PALETTE.text, 'center');
    } else if (kind === 'roundwin') {
      text(`${duel.opponent.name} IS BEATEN`, cx, 120, 44, PALETTE.gold, 'center', true);
      text(`Round ${engineState.round} of 5 is yours. ${CAMPAIGN_ROUNDS - engineState.round} ${CAMPAIGN_ROUNDS - engineState.round === 1 ? 'rival' : 'rivals'} stand between you and the Crown.`, cx, 190, 16, PALETTE.text, 'center');
    } else {
      text(`${duel.opponent.name.toUpperCase()} WINS THE DUEL`, cx, 120, 44, PALETTE.danger, 'center', true);
      text(`"${duel.opponent.taunt}"`, cx, 190, 16, PALETTE.muted, 'center');
      text('The court is not finished with you. Retry the round.', cx, 214, 15, PALETTE.text, 'center');
    }
    // The stats panel: the rival's parting line first, then the numbers. The
    // combo names wrap to their own lines so a long list never spills past
    // the panel's edges.
    const lines = [
      `"${kind === 'lose' ? duel.opponent.loseLine : duel.opponent.winLine}"`,
      `Cards played: ${stats.cardsPlayed}`,
      `Combos fired: ${stats.combos}`,
    ];
    if (engineState.duelCombos && engineState.duelCombos.length > 0) {
      const names = wrapText(engineState.duelCombos.join(', '), 540, 13, 2);
      lines.push(...names);
    }
    lines.push(
      `Damage dealt: ${stats.damageDealt}`,
      `Biggest single hit: ${stats.biggestHit ?? 0}`,
      `Minions summoned: ${stats.minions}`,
      `Mana spent: ${stats.manaSpent ?? 0}`,
      `Turns: ${stats.turns}`,
    );
    if (kind === 'win' && !isQuick) {
      lines.push(`Campaign totals — cards ${engineState.totals.cardsPlayed}, combos ${engineState.totals.combos}, damage ${engineState.totals.damageDealt}`);
    }
    // Stats panel.
    rr(ctx, cx - 300, 260, 600, 60 + lines.length * 26, 12);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    lines.forEach((line, i) => text(line, cx, 292 + i * 26, 13, PALETTE.muted, 'center'));
    const y = 260 + 84 + lines.length * 26;
    if (kind === 'roundwin') {
      drawButton({ x: cx - 270, y, w: 260, h: 60 }, 'NEXT ROUND', `Round ${engineState.round + 1}`, true);
      drawButton({ x: cx + 10, y, w: 260, h: 60 }, 'QUIT TO TITLE', '', true);
      ui.endButtons = {
        primary: { x: cx - 270, y, w: 260, h: 60, action: 'next' },
        secondary: { x: cx + 10, y, w: 260, h: 60, action: 'title' },
      };
    } else if (kind === 'win') {
      drawButton({ x: cx - 270, y, w: 260, h: 60 }, 'PLAY AGAIN', 'new campaign', true);
      drawButton({ x: cx + 10, y, w: 260, h: 60 }, 'QUICK DUEL', 'one match', true);
      ui.endButtons = {
        primary: { x: cx - 270, y, w: 260, h: 60, action: 'again' },
        secondary: { x: cx + 10, y, w: 260, h: 60, action: 'quick' },
      };
    } else {
      // A quick-duel loss offers a rematch; a campaign loss retries the round.
      if (engineState.mode === 'quick') {
        drawButton({ x: cx - 270, y, w: 260, h: 60 }, 'REMATCH', 'a fresh duel', true);
        drawButton({ x: cx + 10, y, w: 260, h: 60 }, 'QUIT TO TITLE', '', true);
        ui.endButtons = {
          primary: { x: cx - 270, y, w: 260, h: 60, action: 'rematch' },
          secondary: { x: cx + 10, y, w: 260, h: 60, action: 'title' },
        };
      } else {
        drawButton({ x: cx - 270, y, w: 260, h: 60 }, 'RETRY ROUND', `Round ${engineState.round}`, true);
        drawButton({ x: cx + 10, y, w: 260, h: 60 }, 'QUIT TO TITLE', '', true);
        ui.endButtons = {
          primary: { x: cx - 270, y, w: 260, h: 60, action: 'retry' },
          secondary: { x: cx + 10, y, w: 260, h: 60, action: 'title' },
        };
      }
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10,6,20,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawPanel(FIELD.width / 2 - 260, 200, 520, 240, 'PAUSED', ['The court waits for you.', ''], '');
    const cx = FIELD.width / 2;
    drawButton({ x: cx - 330, y: 470, w: 210, h: 54 }, 'RESUME', 'keep playing', true);
    drawButton({ x: cx - 105, y: 470, w: 210, h: 54 }, 'RESTART DUEL', 'same rival, fresh deck', true);
    drawButton({ x: cx + 120, y: 470, w: 210, h: 54 }, 'QUIT TO TITLE', '', true);
  }

  // ---- Entry point ---------------------------------------------------------------

  /**
   * Paint one frame. `ui` carries the transient overlays the main loop owns:
   * tell/banner text with expiry times, floating numbers, shake, and the
   * button rects the input layer reads back. Returns the layout for hit-testing.
   */
  function draw(engineState, ui) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = ui.shakeUntil > performance.now() ? ui.shakeMag : 0;
    const sx = shake ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake ? (Math.random() * 2 - 1) * shake : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    ui.titleButtons = null;
    ui.mapButtons = null;
    ui.howtoButtons = null;
    ui.endButtons = null;
    ui.pausedButtons = null;
    ui.collectionButtons = null;
    ui.collectionCards = null;
    ui.mulligan = null;
    let layout = computeLayout(engineState);
    const phase = engineState.phase;
    if (phase === SCREEN_TITLE) drawTitle(engineState, ui);
    else if (phase === SCREEN_MAP) drawMap(engineState, ui);
    else if (phase === SCREEN_HOWTO) drawHowto(engineState, ui);
    else if (phase === SCREEN_COLLECTION) drawCollection(engineState, ui);
    else if (phase === SCREEN_DUEL || phase === SCREEN_PAUSED) {
      layout = drawDuel(engineState, ui);
      if (phase === SCREEN_PAUSED) {
        drawPaused();
        const cx = FIELD.width / 2;
        ui.pausedButtons = {
          resume: { x: cx - 330, y: 470, w: 210, h: 54 },
          restart: { x: cx - 105, y: 470, w: 210, h: 54 },
          quit: { x: cx + 120, y: 470, w: 210, h: 54 },
        };
      }
    } else if (phase === SCREEN_ROUNDWIN) drawEndScreen(engineState, ui, 'roundwin');
    else if (phase === SCREEN_WIN) drawEndScreen(engineState, ui, 'win');
    else if (phase === SCREEN_LOSE) drawEndScreen(engineState, ui, 'lose');
    return layout;
  }


  // ---- The Collection: every card and combo, browsable -------------------------
  // Ten cards a row, four rows for the whole collection, one row when an element
  // is filtered. Click a card to read its lore and the combos it belongs to.

  function drawCollection(engineState, ui) {
    const cx = FIELD.width / 2;
    text('THE COLLECTION', cx, 52, 34, PALETTE.text, 'center', true);
    text('40 Cards · 12 Combos — click a card to read its lore', cx, 78, 13, PALETTE.muted, 'center');
    const filters = ['all', 'ember', 'tide', 'thorn', 'gale', 'deck', 'rivals'];
    const labels = { all: 'ALL', ember: 'EMBER', tide: 'TIDE', thorn: 'THORN', gale: 'GALE', deck: 'YOUR DECK', rivals: 'RIVALS' };
    ui.collectionButtons = { filters: {}, back: { x: 1140, y: 16, w: 120, h: 36 } };
    const bw = 104;
    const bh = 30;
    const gap = 8;
    let fx = cx - (filters.length * (bw + gap) - gap) / 2;
    filters.forEach((f) => {
      const active = engineState.collectionFilter === f;
      const rect = { x: fx, y: 92, w: bw, h: bh };
      ui.collectionButtons.filters[f] = rect;
      rr(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.fillStyle = active ? PALETTE.button : PALETTE.panel;
      ctx.fill();
      ctx.lineWidth = active ? 2 : 1.5;
      ctx.strokeStyle = active ? PALETTE.gold : PALETTE.panelEdge;
      ctx.stroke();
      text(labels[f], rect.x + rect.w / 2, rect.y + 20, 12, active ? '#ffffff' : PALETTE.muted, 'center', true);
      fx += bw + gap;
    });
    drawButton(ui.collectionButtons.back, 'BACK', '', true);
    const filter = engineState.collectionFilter;
    // The Rivals tab is a codex, not a card grid: one panel per opponent.
    if (filter === 'rivals') {
      const opponents = ui.opponents;
      const pw = 200;
      const ph = 400;
      const gap = 16;
      const totalW = opponents.length * pw + (opponents.length - 1) * gap;
      let ox = (FIELD.width - totalW) / 2;
      const oy = 140;
      ui.collectionCards = [];
      opponents.forEach((opp, i) => {
        const info = ELEMENT_INFO[opp.element === 'mixed' ? 'ember' : opp.element];
        rr(ctx, ox, oy, pw, ph, 12);
        ctx.fillStyle = PALETTE.panel;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = PALETTE.panelEdge;
        ctx.stroke();
        circle(ctx, ox + pw / 2, oy + 56, 34);
        ctx.fillStyle = info.color;
        ctx.fill();
        drawGlyph(info.glyph, ox + pw / 2, oy + 56, 38, '#ffffff');
        text(`${i + 1}. ${opp.name}`, ox + pw / 2, oy + 122, 17, PALETTE.text, 'center', true);
        text(opp.title, ox + pw / 2, oy + 144, 11, PALETTE.muted, 'center');
        text(`${HERO_HP + opp.hpBonus} life`, ox + pw / 2, oy + 166, 12, PALETTE.hp, 'center', true);
        text(opp.element === 'mixed' ? 'all elements' : `${opp.element} deck`, ox + pw / 2, oy + 186, 12, info.light, 'center', true);
        // Aggression bar: how often the rival swings at your hero.
        text('Aggression', ox + 16, oy + 214, 11, PALETTE.muted, 'left', true);
        rr(ctx, ox + 16, oy + 222, pw - 32, 10, 5);
        ctx.fillStyle = '#3a2f4e';
        ctx.fill();
        rr(ctx, ox + 16, oy + 222, (pw - 32) * opp.aggression, 10, 5);
        ctx.fillStyle = info.color;
        ctx.fill();
        const tellLines = wrapText(opp.tell, pw - 32, 11, 3);
        tellLines.forEach((line, li) => {
          text(line, ox + pw / 2, oy + 258 + li * 15, 11, PALETTE.muted, 'center');
        });
        const tauntLines = wrapText(`“${opp.taunt}”`, pw - 32, 11, 3);
        tauntLines.forEach((line, li) => {
          text(line, ox + pw / 2, oy + 316 + li * 15, 11, PALETTE.gold, 'center');
        });
        ox += pw + gap;
      });
      text('Five courts, one crown. Beat them in order — each one hits harder than the last.', FIELD.width / 2, 692, 13, PALETTE.muted, 'center');
      return;
    }
    const shown = filter === 'all'
      ? CARDS
      : filter === 'deck'
        ? PLAYER_DECK.map((id) => cardById(id))
        : CARDS.filter((c) => c.element === filter);
    // The deck tab names its shape: how many cards of each element it holds.
    if (filter === 'deck') {
      const counts = { ember: 0, tide: 0, thorn: 0, gale: 0 };
      for (const id of PLAYER_DECK) counts[cardById(id).element] += 1;
      text(`Your 30-card deck — Ember ${counts.ember} · Tide ${counts.tide} · Thorn ${counts.thorn} · Gale ${counts.gale}`, FIELD.width / 2, 128, 12, PALETTE.muted, 'center');
    }
    const cw = 92;
    const ch = 130;
    const scale = cw / 104;
    const gapX = 6;
    const gapY = 8;
    const cols = 10;
    const gridW = cols * cw + (cols - 1) * gapX;
    const x0 = (FIELD.width - gridW) / 2;
    const y0 = 134;
    ui.collectionCards = [];
    shown.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = x0 + col * (cw + gapX);
      const y = y0 + row * (ch + gapY);
      const selected = engineState.collectionCard === card.id;
      drawCardFaceScaled(x, y, scale, card, { selected });
      ui.collectionCards.push({ cardId: card.id, x, y, w: cw, h: ch });
    });
    // Lore strip along the bottom: the selected card's story and its combos.
    const selected = engineState.collectionCard ? cardById(engineState.collectionCard) : null;
    if (selected) {
      const combos = [ELEMENT_COMBOS[selected.element].name];
      for (const pair of PAIR_COMBOS) {
        if (pair.cards.includes(selected.id)) combos.push(pair.name);
      }
      text(`Combos: ${combos.join(' · ')}`, cx, 682, 12, PALETTE.gold, 'center');
      text(`${selected.name} — ${CARD_LORE[selected.id] ?? ''}`, cx, 702, 13, PALETTE.muted, 'center');
    } else {
      text('Click a card to read its lore — and to see which combos it belongs to.', cx, 692, 13, PALETTE.muted, 'center');
    }
  }

  // ---- The element wheel: each element beats the next, clockwise ---------------
  // Ember burns Thorn, Thorn chokes Gale, Gale scatters Tide, Tide drowns Ember.

  function drawWheel(cx, cy, r) {
    const order = ['ember', 'thorn', 'gale', 'tide'];
    // Arrows first, so the discs sit on top of their tails.
    ctx.save();
    ctx.strokeStyle = PALETTE.muted;
    ctx.lineWidth = 2;
    for (let i = 0; i < order.length; i += 1) {
      const a0 = -Math.PI / 2 + (i * Math.PI) / 2 + 0.42;
      const a1 = -Math.PI / 2 + (((i + 1) % order.length) * Math.PI) / 2 - 0.42;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
      // Arrowhead at the end of the arc, pointing along it.
      const ex = cx + Math.cos(a1) * r;
      const ey = cy + Math.sin(a1) * r;
      const dir = a1 + Math.PI / 2;
      ctx.fillStyle = PALETTE.muted;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(dir) * 9, ey + Math.sin(dir) * 9);
      ctx.lineTo(ex + Math.cos(dir + 2.5) * 8, ey + Math.sin(dir + 2.5) * 8);
      ctx.lineTo(ex + Math.cos(dir - 2.5) * 8, ey + Math.sin(dir - 2.5) * 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    order.forEach((el, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const info = ELEMENT_INFO[el];
      circle(ctx, x, y, 26);
      ctx.fillStyle = info.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      drawGlyph(info.glyph, x, y, 26, '#ffffff');
      text(info.name, x, y + 42, 11, PALETTE.text, 'center', true);
    });
  }

  return { draw, resize, computeLayout, drawCardFace };
}
