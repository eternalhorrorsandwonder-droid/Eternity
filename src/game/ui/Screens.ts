/**
 * The data screens.
 *
 * Inventory, skills, attributes, boards, map and codex. Each one is a
 * function that fills a screen element and wires its own events, so the shell
 * in `AppUi` stays small and every screen can be reasoned about on its own.
 *
 * All of them read the live game state rather than a copy: closing and
 * reopening the inventory shows the same items, because both read the same
 * `PlayerState`.
 */

import { Game } from '../Game';
import { ITEMS, ITEM_LIST, itemName, ITEM_BY_ID } from '../data/Items';
import { SLOT_ORDER, SLOT_LABEL, GEAR_SETS, gearDef, type GearSlot } from '../data/Equipment';
import { SKILLS, SKILL_BY_ID, skillsInTree, TREE_LABEL, TREE_ORDER, type SkillTree } from '../data/Skills';
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABEL, ATTRIBUTE_DESC, attributeCost, xpToNext } from '../systems/Stats';
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_GROUPS, TITLES } from '../data/Achievements';
import { QUEST_BY_ID } from '../data/Quests';
import { DUNGEONS, DUNGEON_BY_ID } from '../data/Dungeons';
import { CODEX_BY_ID, CODEX_CATEGORIES } from '../data/Lore';
import { REGIONS, REGION_BY_ID, regionAt, REGION_SIZE } from '../data/Regions';
import { resolveEnemy } from '../data/Enemies';
import { BOSS_ARENA_CELLS } from '../../engine/render/World';
import { World } from '../../engine/render/World';
import { REGION_DISCOVERED, REGION_VISITED, REGION_COUNT } from '../systems/Progress';

function div(className?: string, text?: string): HTMLElement {
  const e = document.createElement('div');
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function hex(n: number): string { return '#' + n.toString(16).padStart(6, '0'); }

/** Shared header for a data screen. */
function header(title: string, sub: string): HTMLElement {
  const h = div('screen-header');
  h.innerHTML = `<h2>${title}</h2><p class="menu-sub">${sub}</p>`;
  return h;
}

// ====================================================================== inventory

export function buildInventory(game: Game, screen: HTMLElement): void {
  screen.append(header('Inventory', 'Click an item to equip, use or craft.'));
  const layout = div('inv-layout');
  const grid = div('inv-grid');
  for (let i = 0; i < 64; i++) {
    const cell = div('inv-cell');
    cell.dataset.slot = String(i);
    cell.addEventListener('click', () => onCell(game, i));
    grid.append(cell);
  }
  const panel = div('inv-panel');
  layout.append(grid, panel);
  screen.append(layout);

  const actions = div('screen-actions');
  actions.innerHTML = `<button class="btn" data-inv="close">Close <kbd>Esc</kbd></button>`;
  screen.append(actions);
  actions.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-inv]')) game.popOverlay();
  });

  function render(): void {
    const st = game.playerState;
    if (!st) return;
    const cells = screen.querySelectorAll('.inv-cell');
    st.inventory.forEach((stack, i) => {
      const cell = cells[i] as HTMLElement | undefined;
      if (!cell) return;
      if (!stack) {
        cell.className = 'inv-cell empty';
        cell.innerHTML = '';
        return;
      }
      const def = ITEMS[stack.id];
      cell.className = 'inv-cell';
      cell.innerHTML = `<span class="inv-name" style="color:${hex(def?.color || 0xcccccc)}">${def?.name || `#${stack.id}`}</span>
        <span class="inv-count">${stack.count}${def && def.durability ? `/${def.durability}` : ''}</span>`;
      cell.style.borderColor = def && def.kind === 'weapon' ? '#e0a040'
        : def && def.kind === 'armor' ? '#7aa0e0' : '';
    });
    // Equipment.
    const eq = div('inv-equipped');
    eq.innerHTML = `<h4>Equipped</h4>`;
    for (const slot of SLOT_ORDER) {
      const row = div('inv-equip-row');
      const eqItem = st.equipped[slot];
      const def = eqItem ? ITEMS[eqItem.id] : null;
      row.innerHTML = `<span class="inv-equip-slot">${SLOT_LABEL[slot]}</span>
        <span class="inv-equip-name" style="color:${hex(def?.color || 0x888888)}">${def?.name || '—'}</span>`;
      if (eqItem) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-tiny';
        btn.textContent = 'Unequip';
        btn.addEventListener('click', () => { game.unequip(slot); render(); });
        row.append(btn);
      }
      eq.append(row);
    }
    panel.innerHTML = '';
    panel.append(eq);
    renderRecipes(panel);
    renderStats(panel);
  }

  function renderStats(panel: HTMLElement): void {
    const st = game.playerState;
    if (!st) return;
    const box = div('inv-stats');
    const s = game.scene_?.player.stats;
    if (!s) return;
    const rows: [string, string][] = [
      ['Health', `${Math.round(s.maxHealth).toLocaleString()}`],
      ['Mana', `${Math.round(s.maxMana).toLocaleString()}`],
      ['Damage', `${Math.round(s.flatDamage * (1 + s.percentDamage))}`],
      ['Armour', `${Math.round(s.armor)}`],
      ['Crit', `${Math.round(s.critChance * 100)}%`],
      ['Crit damage', `+${Math.round(s.critDamage * 100)}%`],
      ['Dodge', `${Math.round(s.dodge * 100)}%`],
      ['Lifesteal', `${(s.lifesteal * 100).toFixed(1)}%`],
      ['Move speed', `${s.movementSpeed.toFixed(2)} b/s`],
      ['Reach', `${s.reach.toFixed(1)} blocks`],
      ['Attack speed', `${s.attackSpeed.toFixed(2)}/s`],
      ['Spell power', `${Math.round(s.spellPower)}`],
    ];
    box.innerHTML = `<h4>Power</h4>` + rows.map(([k, v]) =>
      `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('');
    panel.append(box);
  }

  function renderRecipes(panel: HTMLElement): void {
    const st = game.playerState;
    if (!st) return;
    // Recipes the player can actually craft right now, cheapest first.
    const usable = ITEM_LIST.filter((d) => d.recipe && d.recipe.some((x) => x !== 0))
      .filter((d) => {
        if (d.kind !== 'tool' && d.kind !== 'weapon' && d.kind !== 'armor' && d.kind !== 'potion') return false;
        return d.recipe!.every((x) => x === 0 || st.inventory.some((s) => s && s.id === x && s.count > 0));
      })
      .slice(0, 24);
    const box = div('inv-recipes');
    box.innerHTML = `<h4>Craftable (${usable.length})</h4>`;
    if (!usable.length) {
      box.append(div('inv-empty', 'Nothing to craft — gather materials from the world.'));
      panel.append(box);
      return;
    }
    const grid2 = div('recipe-grid');
    for (const def of usable) {
      const chip = div('recipe-chip');
      chip.innerHTML = `<b style="color:${hex(def.color || 0xcccccc)}">${def.name}</b>
        <span>${def.recipe!.filter((x) => x !== 0).map((x) => itemName(x)).join(', ')}</span>`;
      chip.addEventListener('click', () => {
        if (game.craft(def.id)) render();
        else game.scene_?.pushMessage({ text: 'Not enough materials', color: 0xe05050, kind: 'system', life: 1.5 });
      });
      grid2.append(chip);
    }
    box.append(grid2);
    panel.append(box);
  }

  function onCell(g: Game, i: number): void {
    const st = g.playerState;
    if (!st) return;
    const stack = st.inventory[i];
    if (!stack) return;
    const def = ITEMS[stack.id];
    if (!def) return;
    if (def.kind === 'potion' || def.kind === 'food') {
      g.consume(i);
      render();
      return;
    }
    const gd = gearDef(stack.id);
    if (gd) {
      if (g.equip(i)) render();
      return;
    }
    g.scene_?.pushMessage({ text: 'This item cannot be equipped.', color: 0xb0b0b8, kind: 'system', life: 1.4 });
  }

  render();
}

// ====================================================================== skills

export function buildSkills(game: Game, screen: HTMLElement): void {
  screen.append(header('Skills', 'Spend points in three trees. Actives go on Q, E, R and F.'));
  const state = game.playerState;
  const points = state?.skillPoints ?? 0;
  const top = div('skills-top');
  top.innerHTML = `<span>Skill points: <b data-sp>${points}</b></span>
    <span>Trained: <b data-trained>${state ? Object.values(state.skillLevels).reduce((a, b) => a + b, 0) : 0}</b></span>
    <button class="btn btn-tiny" data-reset>Reset</button>`;
  screen.append(top);
  top.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-reset]')) {
      // Reset is offered per tree through the tree header buttons.
      const tree = (e.target as HTMLElement).closest('[data-tree]') as HTMLElement | null;
      if (tree) resetTree(game, tree.dataset.tree as SkillTree);
    }
  });

  const layout = div('skills-layout');
  for (const tree of TREE_ORDER) {
    const column = div('skill-tree');
    const defs = skillsInTree(tree);
    column.innerHTML = `<div class="skill-tree-head"><h3>${TREE_LABEL[tree]}</h3>
      <button class="btn btn-tiny" data-tree="${tree}">Reset tree</button></div>`;
    for (const def of defs) {
      const node = div('skill-node');
      const lvl = state?.skillLevels[def.id] || 0;
      const can = (state?.skillLevels || {}) && game.spendSkillReady(def.id);
      const stats = Object.entries(def.perLevel || {})
        .map(([k, v]) => `<span class="skill-stat">${skillStatLabel(k, v as number)}</span>`).join('');
      node.innerHTML = `
        <div class="skill-node-head">
          <span class="skill-tier">T${def.tier}</span>
          <b class="skill-name ${lvl ? 'trained' : ''}">${def.name}</b>
          <span class="skill-level">${lvl}/${def.maxLevel}</span>
        </div>
        <p class="skill-desc">${def.description}</p>
        <div class="skill-stats">${stats}</div>
        <p class="skill-detail">${def.detail}</p>
        ${def.kind === 'active' ? `<div class="skill-active">
          <span>Active</span><span>${def.cooldown ? `${def.cooldown}s cd` : ''} ${def.cost ? `· ${def.cost} mana` : ''}</span>
        </div>` : '<div class="skill-passive">Passive</div>'}
        <div class="skill-actions">
          ${lvl > 0 ? '<button class="btn btn-tiny" data-active="' + def.id + '">Assign</button>' : ''}
          <button class="btn btn-tiny ${can ? 'btn-primary' : ''}" data-train="${def.id}" ${can ? '' : 'disabled'}>
            ${lvl >= def.maxLevel ? 'Max' : `Train (${def.tier === lvl || lvl === 0 ? 'available' : 'locked'})`}
          </button>
        </div>`;
      node.addEventListener('click', (e) => {
        const train = (e.target as HTMLElement).closest('[data-train]') as HTMLElement | null;
        const active = (e.target as HTMLElement).closest('[data-active]') as HTMLElement | null;
        const reset = (e.target as HTMLElement).closest('[data-tree]') as HTMLElement | null;
        if (train) {
          if (game.spendSkill(train.dataset.train!)) {
            game.audio.play('levelup', 0.8);
            requestScreenRefresh(game);
          }
        } else if (active) {
          assignActive(game, active.dataset.active!);
          requestScreenRefresh(game);
        } else if (reset) {
          resetTree(game, reset.dataset.tree as SkillTree);
          requestScreenRefresh(game);
        }
      });
      column.append(node);
    }
    layout.append(column);
  }
  screen.append(layout);

  const actions = div('screen-actions');
  actions.innerHTML = `<button class="btn btn-primary" data-close>Done <kbd>Esc</kbd></button>`;
  screen.append(actions);
  actions.addEventListener('click', () => game.popOverlay());

  function assignActive(g: Game, id: string): void {
    const p = g.scene_?.player;
    if (!p) return;
    const ids = (p.state.activeSkills || []).slice();
    const idx = ids.indexOf(id);
    if (idx >= 0) ids[idx] = '';
    else {
      const empty = ids.indexOf('');
      if (empty >= 0) ids[empty] = id;
      else ids.push(id);
    }
    if (p.setActiveSkills(ids.filter(Boolean))) g.requestHud();
  }
}

function skillStatLabel(key: string, value: number): string {
  const pct = ['percent_damage', 'percent_armor', 'percent_hp', 'percent_speed', 'crit_chance', 'crit_damage', 'lifesteal', 'spell_power', 'cooldown_reduction', 'knockback', 'resistance', 'hp_regen', 'fire_damage', 'cold_damage', 'arcane_damage', 'holy_damage', 'void_damage', 'dodge', 'mana_regen'];
  const labels: Record<string, string> = {
    flat_damage: 'damage', percent_damage: 'damage', attack_speed: 'attack speed',
    move_speed: 'move speed', flat_speed: 'move speed', percent_speed: 'move speed',
    flat_hp: 'health', percent_hp: 'health', flat_armor: 'armour', percent_armor: 'armour',
    crit_chance: 'crit chance', crit_damage: 'crit damage', lifesteal: 'lifesteal',
    life_on_kill: 'life per kill', life_on_hit: 'life per hit', mana_max: 'mana',
    mana_regen: 'mana regen', spell_power: 'spell power', cooldown_reduction: 'cooldown',
    dodge: 'dodge', knockback: 'knockback', reach: 'reach', hp_regen: 'regen',
    dash_charges: 'dashes', buff_duration: 'buff duration', pet_damage: 'pet damage',
    threat_generation: 'threat', fire_damage: 'fire', cold_damage: 'cold',
    arcane_damage: 'arcane', holy_damage: 'holy', void_damage: 'void',
    resistance: 'resistance', respawn_health: 'respawn', execution_threshold: 'execute',
  };
  const label = labels[key] || key;
  return `${pct.includes(key) ? `+${(value * 100).toFixed(1)}%` : `+${value.toFixed(2)}`} ${label}`;
}

function resetTree(game: Game, tree: SkillTree): void {
  const p = game.scene_?.player;
  if (!p) return;
  let refund = 0;
  for (const def of skillsInTree(tree)) {
    const lvl = p.state.skillLevels[def.id] || 0;
    if (lvl > 0) { refund += lvl; delete p.state.skillLevels[def.id]; }
  }
  p.state.skillPoints += refund;
  p.recompute();
  game.requestHud();
  game.audio.play('ui_back', 0.6);
}

// ====================================================================== attributes

export function buildAttributes(game: Game, screen: HTMLElement): void {
  screen.append(header('Attributes', 'Ten is the base. Every point raises something.'));
  const st = game.playerState;
  const player = game.scene_?.player;
  if (!st || !player) return;

  const top = div('skills-top');
  top.innerHTML = `<span>Points: <b>${st.attributePoints}</b></span>
    <span>Total spent: <b>${ATTRIBUTE_KEYS.reduce((a, k) => a + attributeCost(st.attributes[k]), 0)}</b></span>
    <button class="btn btn-tiny" data-reset>Reset All</button>`;
  screen.append(top);
  top.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-reset]')) {
      game.resetAttributes();
      requestScreenRefresh(game);
    }
  });

  const grid = div('attr-grid');
  for (const key of ATTRIBUTE_KEYS) {
    const value = st.attributes[key];
    const node = div('attr-card');
    const nextCost = attributeCost(value + 1) - attributeCost(value);
    node.innerHTML = `
      <div class="attr-head"><b>${ATTRIBUTE_LABEL[key]}</b><span class="attr-value">${value}</span></div>
      <p class="attr-desc">${ATTRIBUTE_DESC[key]}</p>
      <div class="attr-bar"><div class="attr-bar-fill" style="width:${Math.min(100, ((value - 10) / 300) * 100)}%"></div></div>
      <div class="attr-cost">Next costs ${nextCost} point${nextCost > 1 ? 's' : ''} · ${value >= 320 ? 'at the cap' : ''}</div>
      <button class="btn btn-primary ${st.attributePoints > 0 && value < 320 ? '' : 'btn-ghost'}" data-up="${key}" ${st.attributePoints > 0 && value < 320 ? '' : 'disabled'}>Raise +1</button>`;
    node.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-up]') as HTMLElement | null;
      if (!btn) return;
      if (game.spendAttribute(key as 'strength')) {
        game.audio.play('levelup', 0.7);
        requestScreenRefresh(game);
      }
    });
    grid.append(node);
  }
  screen.append(grid);

  const actions = div('screen-actions');
  actions.innerHTML = `<button class="btn btn-primary" data-close>Done <kbd>Esc</kbd></button>`;
  screen.append(actions);
  actions.addEventListener('click', () => game.popOverlay());
}

// ====================================================================== boards

export function buildBoards(game: Game, screen: HTMLElement): void {
  screen.append(header('Boards', 'Achievements, titles, progression and power — all from the same numbers the game uses.'));
  const tabs = div('board-tabs');
  const tabDefs = [
    { id: 'ach', label: 'Achievement Board' },
    { id: 'var', label: 'Variable Board' },
    { id: 'lvl', label: 'Level Board' },
    { id: 'pow', label: 'Power Board' },
  ];
  tabs.innerHTML = tabDefs.map((t) => `<button class="board-tab ${t.id === 'ach' ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
  screen.append(tabs);
  const body = div('board-body');
  screen.append(body);

  function renderTab(id: string): void {
    body.innerHTML = '';
    if (id === 'ach') renderAchievements(body);
    else if (id === 'var') renderVariable(body);
    else if (id === 'lvl') renderLevels(body);
    else renderPower(body);
  }

  tabs.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null;
    if (!tab) return;
    game.audio.play('ui_click', 0.6);
    tabs.querySelectorAll('.board-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    renderTab(tab.dataset.tab!);
  });
  renderTab('ach');

  const actions = div('screen-actions');
  actions.innerHTML = `<button class="btn btn-primary" data-close>Done <kbd>Esc</kbd></button>`;
  screen.append(actions);
  actions.addEventListener('click', () => game.popOverlay());

  function renderAchievements(body: HTMLElement): void {
    const st = game.playerState;
    const groups = ACHIEVEMENT_GROUPS;
    for (const g of groups) {
      const list = ACHIEVEMENT_BY_ID;
      const items = [...list.values()].filter((a) => a.group === g.id);
      if (!items.length) continue;
      const block = div('board-group');
      block.innerHTML = `<h3 style="color:${hex(g.color)}">${g.label} <span class="board-count">${items.filter((a) => st?.achievements.includes(a.id)).length}/${items.length}</span></h3>`;
      const grid2 = div('board-grid');
      for (const a of items) {
        const got = !!st?.achievements.includes(a.id);
        const have = (st?.stats[a.check] || 0);
        const chip = div(`board-chip ${got ? 'done' : ''} ${a.secret ? 'secret' : ''}`);
        chip.innerHTML = `<span class="board-chip-name">${got || !a.secret ? a.name : '???'}</span>
          <span class="board-chip-desc">${got ? a.description : a.secret ? 'Hidden achievement' : a.description}</span>
          <span class="board-chip-prog">${Math.min(have, a.count)}/${a.count}</span>`;
        grid2.append(chip);
      }
      block.append(grid2);
      body.append(block);
    }
  }

  function renderVariable(body: HTMLElement): void {
    const st = game.playerState;
    if (!st) return;
    const unlocked = st.titles.map((t) => TITLES.find((x) => x.id === t || x.name === t)).filter(Boolean) as { id: string; name: string; color: number }[];
    const block = div('board-group');
    block.innerHTML = `<h3 style="color:#ffe070">Titles <span class="board-count">${st.titles.length}/${TITLES.length}</span></h3>`;
    const grid2 = div('board-grid');
    for (const t of TITLES) {
      const got = st.titles.includes(t.name) || st.titles.includes(t.id);
      const chip = div(`board-chip title ${got ? 'done' : ''}`);
      chip.innerHTML = `<span class="board-chip-name" style="color:${hex(t.color)}">${got ? t.name : '???'}</span>
        <span class="board-chip-desc">${t.description}</span>`;
      grid2.append(chip);
    }
    block.append(grid2);
    body.append(block);

    const statsBlock = div('board-group');
    statsBlock.innerHTML = `<h3>Counters</h3>`;
    const counters: [string, string, number][] = [
      ['kills', 'Enemies defeated', st.stats.kills || 0],
      ['blocksMined', 'Blocks mined', st.stats.blocksMined || 0],
      ['crafted', 'Items crafted', st.stats.crafted || 0],
      ['chestsOpened', 'Chests opened', st.stats.chestsOpened || 0],
      ['regionsVisited', 'Regions visited', st.stats.regionsVisited || 0],
      ['damageDealt', 'Damage dealt', Math.round(st.stats.damageDealt || 0)],
      ['damageTaken', 'Damage taken', Math.round(st.stats.damageTaken || 0)],
      ['deaths', 'Deaths', st.stats.deaths || 0],
      ['achievements', 'Achievements', st.achievements.length],
      ['itemsBroken', 'Tools broken', st.stats.itemsBroken || 0],
      ['potionsUsed', 'Potions used', st.stats.potionsUsed || 0],
      ['playtime', 'Minutes played', Math.floor((st.stats.playtime || 0) / 60)],
    ];
    statsBlock.innerHTML += counters.map(([k, label, v]) =>
      `<div class="stat-row"><span>${label}</span><b>${v.toLocaleString()}</b></div>`).join('');
    body.append(statsBlock);
    void unlocked;
  }

  function renderLevels(body: HTMLElement): void {
    const st = game.playerState;
    if (!st) return;
    const block = div('board-group');
    const next = xpToNext(st.level);
    block.innerHTML = `<h3>Level ${st.level}</h3>
      <div class="lvl-bar"><div class="lvl-fill" style="width:${Math.min(100, (st.xp / Math.max(1, next)) * 100)}%"></div></div>
      <p class="lvl-text">${st.xp.toLocaleString()} / ${next.toLocaleString()} experience</p>`;
    const rows: [string, string][] = [
      ['Attribute points banked', String(st.attributePoints)],
      ['Attribute points spent', String(ATTRIBUTE_KEYS.reduce((a, k) => a + attributeCost(st.attributes[k]), 0))],
      ['Skill points banked', String(st.skillPoints)],
      ['Skill points spent', String(Object.values(st.skillLevels).reduce((a, b) => a + b, 0))],
      ['Active skill slots', String(st.activeSkills.length)],
      ['Quests completed', String(Object.values(st.quests).filter((q) => q.done).length)],
      ['Quests accepted', String(Object.keys(st.quests).length)],
      ['Codex entries', String(st.codex.length)],
      ['Regions visited', String(st.visitedRegions.length)],
      ['Dungeons unlocked', String(st.unlockedDungeons.length)],
    ];
    block.innerHTML += rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('');
    body.append(block);

    const perk = div('board-group');
    perk.innerHTML = `<h3>Per-Level Growth</h3>`;
    const growth: [string, string][] = [
      ['Damage', '+3.5% per level'],
      ['Health', '+1.8% per level'],
      ['Mana', '+1.5% per level'],
      ['Spell power', '+2.0% per level'],
      ['Attributes', '+3 points per level'],
      ['Skills', '+1 point per level'],
    ];
    perk.innerHTML += growth.map(([k, v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('');
    body.append(perk);
  }

  function renderPower(body: HTMLElement): void {
    const st = game.playerState;
    const player = game.scene_?.player;
    if (!st || !player) return;
    const s = player.stats;
    const block = div('board-group');
    block.innerHTML = `<h3>Derived Statistics</h3>`;
    const rows: [string, string, string][] = [
      ['Maximum health', `${Math.round(s.maxHealth).toLocaleString()}`, 'constitution · equipment · level'],
      ['Maximum mana', `${Math.round(s.maxMana).toLocaleString()}`, 'intelligence · equipment · level'],
      ['Base damage', `${Math.round(s.flatDamage).toLocaleString()}`, 'strength · weapon · level'],
      ['Damage multiplier', `+${(s.percentDamage * 100).toFixed(1)}%`, 'gear, sets, skills'],
      ['Spell power', `${Math.round(s.spellPower).toLocaleString()}`, 'intelligence · skills'],
      ['Armour', `${Math.round(s.armor).toLocaleString()}`, 'constitution · equipment'],
      ['Armour toughness', `${Math.round(s.toughness)}`, 'equipment'],
      ['Critical chance', `${Math.round(s.critChance * 100)}%`, 'strength · wisdom · gear'],
      ['Critical damage', `+${Math.round(s.critDamage * 100)}%`, 'dexterity · gear'],
      ['Dodge', `${Math.round(s.dodge * 100)}%`, 'dexterity · gear'],
      ['Lifesteal', `${(s.lifesteal * 100).toFixed(1)}%`, 'wisdom · gear'],
      ['Life on kill', `${s.lifeOnKill}`, 'gear · skills'],
      ['Movement speed', `${s.movementSpeed.toFixed(2)} b/s`, 'dexterity · speed gear'],
      ['Reach', `${s.reach.toFixed(1)} blocks`, 'weapon · reach gear'],
      ['Attack speed', `${s.attackSpeed.toFixed(2)}/s`, 'weapon · attack speed'],
      ['Cooldown reduction', `${Math.round(s.cooldownReduction * 100)}%`, 'skills'],
      ['Dash charges', `${s.dashCharges}`, 'skills'],
      ['Resistance', `${Math.round(s.resistance * 100)}%`, 'skills · gear'],
      ['Harvest bonus', `+${s.harvestBonus.toFixed(1)} blocks`, 'wisdom'],
    ];
    block.innerHTML += rows.map(([k, v, note]) =>
      `<div class="stat-row"><span>${k}</span><b>${v}</b><i>${note}</i></div>`).join('');
    body.append(block);

    const sets = div('board-group');
    sets.innerHTML = `<h3>Set Bonuses <span class="board-count">${GEAR_SETS.length} sets</span></h3>`;
    for (const set of GEAR_SETS) {
      const have = SLOT_ORDER.filter((slot) => {
        const eq = st.equipped[slot];
        return eq && gearDef(eq.id)?.setId === set.id;
      }).length;
      const block2 = div('set-card');
      block2.innerHTML = `<div class="set-head"><b style="color:${hex(set.color)}">${set.name}</b><span>${have}/${set.pieces.length}</span></div>
        <p class="set-desc">${set.description}</p>`;
      for (const [pieces, bonus] of Object.entries(set.bonuses)) {
        const active = have >= Number(pieces);
        block2.innerHTML += `<div class="set-bonus ${active ? 'active' : ''}">
          <b>${bonus.name}</b><span>${bonus.description}</span></div>`;
      }
      sets.append(block2);
    }
    body.append(sets);
  }
}

// ====================================================================== map

export function buildMap(game: Game, screen: HTMLElement): void {
  screen.append(header('World Map', 'Click a region to travel there.'));
  const world: World | null = game.worldRef;
  const layout = div('map-layout');
  const grid = div('map-grid');
  // The map is drawn from world memory, not from the region list: a region the
  // player has never approached is a blank tile, and one they have stood in
  // is fully charted.
  const memory = game.progressTracker;
  const discovered = (id: number) => (memory.regions[id] & REGION_DISCOVERED) !== 0;
  for (let gz = 0; gz < 12; gz++) {
    for (let gx = 0; gx < 12; gx++) {
      const id = gz * 12 + gx;
      const reg = REGIONS[id];
      const cell = div('map-cell');
      cell.dataset.region = String(id);
      cell.innerHTML = `<span class="map-cell-name">${reg.name}</span>
        <span class="map-cell-biome">${reg.biome}</span>
        <span class="map-cell-lv">Lv ${reg.levelRange[0]}–${reg.levelRange[1]}</span>`;
      if (discovered(id)) cell.classList.add('visited');
      else cell.classList.add('unknown');
      // Remembered landmarks show up on the tile that contains them, which is
      // what makes the map a record of the journey rather than a menu.
      const here = memory.markers_().filter((m) => Math.floor(m.x / 32) === gx && Math.floor(m.z / 32) === gz);
      if (here.length) {
        const dots = div('map-cell-marks');
        dots.innerHTML = here.slice(0, 4).map((m) => `<i class="mark-${m.kind}" title="${m.name}"></i>`).join('');
        cell.append(dots);
      }
      cell.addEventListener('click', () => {
        if (!discovered(id) && !(memory.regions[id] & REGION_VISITED)) {
          game.audio.play('ui_error', 0.7);
          game.scene_?.pushMessage({ text: `${reg.name} is still unknown`, color: 0xe0a040, kind: 'system', life: 2.5 });
          requestScreenRefresh(game);
          return;
        }
        game.travelTo(id);
        game.audio.play('teleport', 0.7);
        requestScreenRefresh(game);
      });
      grid.append(cell);
    }
  }
  layout.append(grid);

  const sidebar = div('map-sidebar');
  sidebar.append(div('map-side-head', 'Dungeons'));
  const dungeons = div('map-list');
  for (const d of DUNGEONS) {
    const row = div('map-row');
    const reg = REGION_BY_ID.get(d.region)!;
    row.innerHTML = `<b>${d.name}</b><span>${reg.name} · Lv ${d.minLevel}+ · ${d.floors} floors</span>`;
    const enter = document.createElement('button');
    enter.className = 'btn btn-tiny';
    enter.textContent = game.playerState && game.playerState.level < d.minLevel ? 'Locked' : 'Enter';
    enter.disabled = !game.playerState || game.playerState.level < d.minLevel;
    enter.addEventListener('click', () => {
      if (game.enterDungeon(d.id)) {
        game.popOverlay();
        game.setPlaying(true);
      }
    });
    row.append(enter);
    dungeons.append(row);
  }
  sidebar.append(dungeons);

  sidebar.append(div('map-side-head', 'Boss Arenas'));
  const arenas = div('map-list');
  for (const [id, cells] of Object.entries(BOSS_ARENA_CELLS)) {
    const [gx, gz] = cells[0];
    const reg = REGION_BY_ID.get(gz * 12 + gx)!;
    const row = div('map-row');
    const def = resolveEnemy(id.replace('boss_arena_', 'boss_')) || resolveEnemy('boss_end');
    row.innerHTML = `<b>${(def?.name || id).replace(/^boss_/, '')}</b>
      <span>${reg.name} · Lv ${Math.max(40, (game.playerState?.level || 1) + 6)}</span>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-tiny btn-primary';
    btn.textContent = 'Enter Arena';
    btn.addEventListener('click', () => {
      game.setArena(id);
      game.popOverlay();
      game.setPlaying(true);
    });
    row.append(btn);
    arenas.append(row);
  }
  sidebar.append(arenas);

  sidebar.append(div('map-side-head', 'Remembered'));
  const remembered = div('map-list');
  const entries = memory.structures_().filter((s) => s.entered).slice(0, 12);
  if (!entries.length) {
    remembered.append(div('map-note', 'Nothing logged yet. Walk towards a structure to record it.'));
  }
  for (const s of entries) {
    const row = div('map-row');
    row.innerHTML = `<b>${s.name}</b><span>${REGION_BY_ID.get(s.region)?.name || 'Unknown'} - ${Math.floor(s.x)}, ${Math.floor(s.z)}</span>`;
    row.addEventListener('click', () => {
      game.travelTo(s.region >= 0 ? s.region : 0);
      game.popOverlay();
      game.setPlaying(true);
    });
    remembered.append(row);
  }
  sidebar.append(remembered);

  sidebar.append(div('map-side-head', 'Exploration'));
  const stats = div('map-list');
  stats.innerHTML = [
    `<div class="map-row"><b>${memory.visitedCount()} / ${REGION_COUNT}</b><span>regions visited</span></div>`,
    `<div class="map-row"><b>${memory.explorationPercent().toFixed(1)}%</b><span>surface explored</span></div>`,
    `<div class="map-row"><b>${memory.bossesDefeated()}</b><span>bosses defeated</span></div>`,
    `<div class="map-row"><b>${memory.dungeonsCleared()}</b><span>dungeons cleared</span></div>`,
    `<div class="map-row"><b>${memory.questCount()}</b><span>quests completed</span></div>`,
    `<div class="map-row"><b>${memory.codexCount()}</b><span>codex entries read</span></div>`,
  ].join('');
  sidebar.append(stats);

  const exit = div('map-row');
  exit.innerHTML = `<b>Leave Dungeon</b><span>Return to the surface</span>`;
  const exitBtn = document.createElement('button');
  exitBtn.className = 'btn btn-tiny';
  exitBtn.textContent = 'Exit';
  exitBtn.addEventListener('click', () => game.leaveDungeon());
  exit.append(exitBtn);
  sidebar.append(exit);

  layout.append(sidebar);
  screen.append(layout);

  const actions = div('screen-actions');
  actions.innerHTML = `<button class="btn btn-primary" data-close>Done <kbd>Esc</kbd></button>`;
  screen.append(actions);
  actions.addEventListener('click', () => game.popOverlay());
}

// ====================================================================== codex

export function buildCodex(game: Game, screen: HTMLElement): void {
  screen.append(header('Codex', 'Lore and bestiary, collected from chests, bosses and the world.'));
  const layout = div('codex-layout');
  const nav = div('codex-nav');
  const list = div('codex-list');
  layout.append(nav, list);
  screen.append(layout);

  function renderCategory(catId: string): void {
    const cat = CODEX_CATEGORIES.find((c) => c.id === catId) || CODEX_CATEGORIES[0];
    const entries = CODEX_BY_ID;
    const items = [...entries.values()].filter((e) => e.category === cat.id);
    list.innerHTML = `<h3>${cat.label} <span class="board-count">${items.length}</span></h3>`;
    if (!items.length) { list.append(div('inv-empty', 'No entries in this category yet.')); return; }
    for (const entry of items) {
      const has = game.playerState?.codex.includes(entry.id) ?? false;
      const card = div(`codex-card ${has ? 'found' : 'locked'}`);
      card.innerHTML = `<div class="codex-head"><b>${has ? entry.title : '???'}</b><span>${has ? entry.source : 'Undiscovered'}</span></div>
        <p class="codex-body">${has ? entry.text : 'You have not found this entry. It is written somewhere in the world.'}</p>`;
      list.append(card);
    }
  }

  nav.innerHTML = CODEX_CATEGORIES.map((c) =>
    `<button class="codex-tab" data-cat="${c.id}">${c.label}</button>`).join('');
  nav.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('[data-cat]') as HTMLElement | null;
    if (!tab) return;
    game.audio.play('ui_click', 0.6);
    nav.querySelectorAll('.codex-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    renderCategory(tab.dataset.cat!);
  });
  renderCategory(CODEX_CATEGORIES[0].id);

  const actions = div('screen-actions');
  actions.innerHTML = `<button class="btn btn-primary" data-close>Done <kbd>Esc</kbd></button>`;
  screen.append(actions);
  actions.addEventListener('click', () => game.popOverlay());
}

// ====================================================================== helpers

/**
 * Rebuild the overlay currently on top. The builders call this after a state
 * change instead of patching the DOM, which keeps every screen a pure
 * function of the game state.
 */
export function requestScreenRefresh(game: Game): void {
  game.refreshOverlay();
}
