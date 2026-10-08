// Appearance preferences are adapter-owned. Game preferences use the website's
// existing keys; its sound/pointer state is initialized at load, so apply by reload.
const displayPreferencesKey = 'goa2-mobile-display';
let displayPreferences = { cardArt: true, fontStep: 0 },
  cursorsVisible = true,
  soundsEnabled = true,
  soundVolume = 100,
  gameSettingsDirty = false,
  appliedFontStep = 0;
try {
  const saved = JSON.parse(localStorage.getItem(displayPreferencesKey) || '{}');
  if (typeof saved?.cardArt === 'boolean') displayPreferences.cardArt = saved.cardArt;
  if (Number.isInteger(saved?.fontStep) && saved.fontStep >= -4 && saved.fontStep <= 4)
    displayPreferences.fontStep = saved.fontStep;
} catch {}
try {
  cursorsVisible = localStorage.getItem('goa2:remote-pointers-visible') !== 'hidden';
  soundsEnabled = localStorage.getItem('goa2.sound.muted') !== '1';
  const saved = localStorage.getItem('goa2.sound.volume'), value = Number(saved);
  if (saved !== null && Number.isFinite(value)) soundVolume = Math.round(Math.max(0, Math.min(150, value * 100)));
} catch {}

function fontScale(step) {
  return step < 0 ? 0.95 ** -step : 1.1 ** step;
}
function applyDisplayPreferences() {
  root.toggleAttribute('data-m2-no-card-art', !displayPreferences.cardArt);
  if (appliedFontStep === displayPreferences.fontStep) return;
  appliedFontStep = displayPreferences.fontStep;
  const factor = fontScale(appliedFontStep);
  // Materialize typography from the canonical sheet, rather than stacking CSS
  // overrides or scaling the board/touch targets. Default restores its exact text.
  const typography = appliedFontStep === 0 ? css : css.replace(
    /\b(font(?:-size)?|line-height)\s*:\s*([^;{}]+)/g,
    (declaration) => declaration.replace(/(\d+(?:\.\d+)?)px/g,
      (_, value) => Number((Number(value) * factor).toFixed(4)) + 'px'),
  );
  style.textContent = inactiveCss + typography.replaceAll('&', 'html[data-m2-active]');
}
function saveDisplayPreferences() {
  try { localStorage.setItem(displayPreferencesKey, JSON.stringify(displayPreferences)); } catch {}
  applyDisplayPreferences();
  updateSettings();
}

const settingHelpText = {
  art: 'Use card illustrations behind card text. On by default. Changes apply immediately and are saved on this device.',
  font: 'Center is the original size (100%). Each step below center multiplies it by 0.95; each step above multiplies it by 1.10. Default resets the size. Changes apply immediately and are saved on this device.',
  cursors: 'Show other players’ pointers on the board. Changes here take effect after Apply & reload.',
  sounds: 'Enable the game’s sound effects. Changes take effect after Apply & reload.',
  volume: 'Adjust game sound from 0% to 150%; 100% is the default. Choosing a volume above zero also enables Sounds. Changes take effect after Apply & reload.',
  fullscreen: 'Expand the game to fill the screen. Available only when your browser supports fullscreen. Changes apply immediately.',
};
function closeSettingHelp() {
  for (const button of settingsPanel.querySelectorAll('[data-setting-info]')) {
    button.setAttribute('aria-expanded', 'false');
    document.getElementById(button.getAttribute('aria-controls')).hidden = true;
  }
}
function settingLabel(label, key, textLabel) {
  const heading = document.createElement('div'), info = document.createElement('button'),
    description = document.createElement('p');
  heading.className = 'm2-setting-label';
  textLabel.textContent = label;
  textLabel.title = settingHelpText[key];
  info.type = 'button';
  info.className = 'm2-setting-info';
  info.dataset.settingInfo = key;
  info.innerHTML = '<span aria-hidden="true">i</span>';
  info.title = settingHelpText[key];
  info.setAttribute('aria-label', 'About ' + label);
  info.setAttribute('aria-expanded', 'false');
  info.setAttribute('aria-controls', description.id = 'm2-setting-help-' + key);
  description.className = 'm2-setting-help';
  description.textContent = settingHelpText[key];
  description.hidden = true;
  on(info, 'click', () => {
    const opening = description.hidden;
    closeSettingHelp();
    description.hidden = !opening;
    info.setAttribute('aria-expanded', String(opening));
  });
  heading.append(textLabel, info);
  return { heading, description };
}
function settingSwitch(label, key, action) {
  const box = document.createElement('div');
  box.className = 'm2-setting-with-help';
  const { heading, description } = settingLabel(label, key, document.createElement('span'));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'm2-setting-switch';
  button.dataset.setting = key;
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-describedby', description.id);
  button.innerHTML = '<i aria-hidden="true"></i>';
  on(button, 'click', action);
  box.append(heading, button, description);
  return box;
}
function settingSlider(label, key, min, max, value, action) {
  const box = document.createElement('div');
  box.className = 'm2-setting-range';
  const heading = document.createElement('label'), output = document.createElement('output'),
    input = document.createElement('input');
  heading.htmlFor = input.id = 'm2-setting-' + key;
  const help = settingLabel(label, key, heading);
  input.setAttribute('aria-describedby', help.description.id);
  output.setAttribute('for', input.id);
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = key === 'volume' ? 5 : 1;
  input.value = value;
  input.dataset.setting = key;
  on(input, 'input', () => action(Number(input.value)));
  box.append(help.heading, output, input, help.description);
  return box;
}
function markGameSettingsDirty() {
  gameSettingsDirty = true;
  updateSettings();
}
function saveGameSettings() {
  try {
    localStorage.setItem('goa2:remote-pointers-visible', cursorsVisible ? 'shown' : 'hidden');
    localStorage.setItem('goa2.sound.muted', soundsEnabled ? '0' : '1');
    localStorage.setItem('goa2.sound.volume', String(soundVolume / 100));
    return true;
  } catch {
    q('.m2-settings-note', settingsPanel).textContent = 'These game settings could not be saved on this device.';
    return false;
  }
}
function buildSettings() {
  settingsPanel.innerHTML = '<h2>Settings</h2><section class="m2-settings-appearance"><h3>Appearance</h3></section><section class="m2-settings-game"><h3>Game</h3></section><section class="m2-settings-tools"><h3>Tools</h3><div class="m2-settings-actions"></div></section>';
  const appearance = q('.m2-settings-appearance', settingsPanel),
    game = q('.m2-settings-game', settingsPanel);
  appearance.append(settingSwitch('Card artwork', 'art', () => {
    displayPreferences.cardArt = !displayPreferences.cardArt;
    saveDisplayPreferences();
  }), settingSlider('Font size', 'font', -4, 4, displayPreferences.fontStep, (value) => {
    displayPreferences.fontStep = value;
    saveDisplayPreferences();
  }));
  const scale = q('.m2-setting-range', appearance), labels = document.createElement('div');
  labels.className = 'm2-font-range-labels';
  labels.innerHTML = '<span>Smaller</span><button type="button">Default</button><span>Larger</span>';
  on(q('button', labels), 'click', () => {
    displayPreferences.fontStep = 0;
    saveDisplayPreferences();
  });
  scale.append(labels);
  game.append(settingSwitch('Player cursors', 'cursors', () => {
    cursorsVisible = !cursorsVisible;
    markGameSettingsDirty();
  }), settingSwitch('Sounds', 'sounds', () => {
    soundsEnabled = !soundsEnabled;
    markGameSettingsDirty();
  }), settingSlider('Sound volume', 'volume', 0, 150, soundVolume, (value) => {
    soundVolume = value;
    if (value > 0) soundsEnabled = true;
    markGameSettingsDirty();
  }));
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'm2-settings-apply';
  apply.textContent = 'Apply & reload';
  on(apply, 'click', () => {
    if (saveGameSettings()) location.reload();
  });
  const note = document.createElement('small');
  note.className = 'm2-settings-note';
  note.textContent = 'Sound and cursor changes apply after reload.';
  game.append(note, apply);
  const fullscreen = settingSwitch('Fullscreen', 'fullscreen', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {}
    updateSettings();
  });
  game.append(fullscreen);
  on(settingsPanel, 'keydown', event => {
    if (event.key === 'Escape') closeSettingHelp();
  });
}
let toolSources = [];
function updateSettings() {
  applyDisplayPreferences();
  root.toggleAttribute('data-m2-hide-cursors', !cursorsVisible);
  if (!settingsPanel.firstChild) buildSettings();
  for (const [key, value] of [['art', displayPreferences.cardArt], ['cursors', cursorsVisible],
      ['sounds', soundsEnabled], ['fullscreen', !!document.fullscreenElement]])
    q('[data-setting="' + key + '"]', settingsPanel).setAttribute('aria-checked', String(value));
  for (const [key, value, percent] of [['font', displayPreferences.fontStep, Math.round(fontScale(displayPreferences.fontStep) * 100)],
      ['volume', soundVolume, soundVolume]]) {
    const input = q('[data-setting="' + key + '"]', settingsPanel);
    if (Number(input.value) !== value) input.value = value;
    input.setAttribute('aria-valuetext', percent + '%');
    q('output', input.parentElement).textContent = percent + '%';
  }
  q('.m2-settings-apply', settingsPanel).hidden = !gameSettingsDirty;
  const fullscreen = q('[data-setting="fullscreen"]', settingsPanel);
  fullscreen.parentElement.hidden = fullscreen.hidden = !document.fullscreenEnabled && !document.fullscreenElement;
  // Preserve React ownership and route actions through the live native controls.
  const sources = Array.from(q('[data-m2="tools"]')?.querySelectorAll('button') || [])
    .filter(button => !isGeneratedNode(button));
  const actions = q('.m2-settings-actions', settingsPanel);
  if (sources.length !== toolSources.length || sources.some((source, i) => source !== toolSources[i])) {
    toolSources = sources;
    actions.replaceChildren();
    for (const source of sources) {
      const proxy = document.createElement('button');
      proxy.type = 'button';
      on(proxy, 'click', () => {
        if (!source.isConnected || source.disabled) return;
        navigate('tools');
        source.click();
      });
      actions.append(proxy);
    }
  }
  sources.forEach((source, i) => {
    const proxy = actions.children[i];
    if (proxy.textContent !== source.textContent) proxy.textContent = source.textContent;
    proxy.disabled = source.disabled;
    proxy.title = source.title;
  });
  q('.m2-settings-tools', settingsPanel).hidden = sources.length === 0;
}
on(document, 'fullscreenchange', () => { if (!dead) updateSettings(); });
