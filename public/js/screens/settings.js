import { api } from '../api.js';
import { chipChoice } from '../components/chips.js';
import { confirmBox } from '../components/dialog.js';
import { toast } from '../components/toast.js';
import { errorBox, h, loadingBox, setChildren } from '../dom.js';
import { getTheme, saveTheme } from '../theme.js';

const QUALITIES = [['low', 'Low (cheapest)'], ['medium', 'Medium'], ['high', 'High']];

// One card per vendor. The two cards behave the same way, only the words and a few fields differ.
const CLAUDE = {
  title: 'Claude (the chef brain)',
  keyLabel: 'API key',
  keyField: 'anthropicApiKey',
  testPath: '/settings/test/anthropic',
  removePath: '/settings/key/anthropic',
  modelsPath: '/models/claude',
  modelField: 'claudeModel',
  modelLabel: 'Model',
  getKeyInfo: (s) => s.claude,
  vendor: 'Anthropic',
  listNote: 'only models that can read photos are shown',
  keyHelp: 'Get a key at console.anthropic.com. It is stored only on this computer.',
  keyPlaceholder: 'Paste your Claude key (starts with sk-ant-)',
};
const OPENAI = {
  title: 'OpenAI (the photographer)',
  keyLabel: 'API key',
  keyField: 'openaiApiKey',
  testPath: '/settings/test/openai',
  removePath: '/settings/key/openai',
  modelsPath: '/models/openai',
  modelField: 'imageModel',
  modelLabel: 'Image model',
  getKeyInfo: (s) => s.openai,
  vendor: 'OpenAI',
  listNote: 'only image models are shown',
  keyHelp: 'Get a key at platform.openai.com. It is stored only on this computer. Only used when you press AI photo.',
  keyPlaceholder: 'Paste your OpenAI key (starts with sk-)',
  hasQuality: true,
};

export async function renderSettings(root, isCurrent) {
  setChildren(root, loadingBox('Loading settings…'));
  let settings;
  try {
    settings = await api('GET', '/settings');
  } catch (err) {
    if (isCurrent()) setChildren(root, errorBox(err.message, () => renderSettings(root, isCurrent)));
    return;
  }
  if (!isCurrent()) return;

  const claudeHost = h('div', { class: 'card' });
  const openaiHost = h('div', { class: 'card' });
  setChildren(root,
    h('div', { class: 'grid two' }, claudeHost, openaiHost),
    h('div', { class: 'card' },
      h('h2', null, 'Look & feel'),
      chipChoice([['light', '☀️ Light'], ['dark', '🌙 Dark'], ['device', '🖥 Match my device']], getTheme(), saveTheme)),
    h('p', { class: 'small' },
      'Your keys and recipes stay on this computer. Text and photos you send are processed by Anthropic (Claude) and, for AI photos, OpenAI, under their terms.'));

  fillCard(claudeHost, CLAUDE, settings);
  fillCard(openaiHost, OPENAI, settings);
}

function fillCard(host, cfg, settings) {
  const info = cfg.getKeyInfo(settings);
  const rebuild = async () => {
    try {
      fillCard(host, cfg, await api('GET', '/settings'));
    } catch (err) {
      setChildren(host, errorBox(err.message, rebuild));
    }
  };

  const keyInput = h('input', {
    class: 'field', type: 'password', id: `key-${cfg.keyField}`, autocomplete: 'off', spellcheck: 'false',
    placeholder: info.hasKey ? `Saved: ${info.maskedKey}` : cfg.keyPlaceholder,
  });
  const keyStatus = h('span', { class: 'status' }, info.hasKey ? 'Key saved' : 'No key yet');

  // Test and Refresh work with the SAVED key. A key that is typed but not saved yet, or no key at all,
  // gets a clear instruction instead of a spinner that has nothing to wait for.
  const mustSaveFirst = () => {
    if (keyInput.value.trim()) { toast('Press Save key first'); return true; }
    if (!info.hasKey) { toast(`Add your ${cfg.vendor} key and press Save key first`); return true; }
    return false;
  };
  const savedStatus = keyStatus.textContent;
  keyInput.addEventListener('input', () => {
    keyStatus.textContent = keyInput.value.trim() ? 'Not saved yet' : savedStatus;
  });

  const testBtn = h('button', { type: 'button', class: 'btn alt sm' }, 'Test');
  testBtn.addEventListener('click', async () => {
    if (mustSaveFirst()) return;
    testBtn.disabled = true;
    try {
      await api('POST', cfg.testPath, {}, { timeout: 25_000 });
      keyStatus.textContent = 'Key OK';
      toast(`${cfg.vendor} key works`);
    } catch (err) {
      keyStatus.textContent = 'Key problem';
      toast(err.message, { error: true });
    } finally {
      testBtn.disabled = false;
    }
  });

  const saveBtn = h('button', { type: 'button', class: 'btn sm' }, 'Save key');
  saveBtn.addEventListener('click', async () => {
    const typed = keyInput.value.trim();
    if (!typed) { toast('Type or paste a key first'); return; }
    saveBtn.disabled = true;
    try {
      await api('PUT', '/settings', { [cfg.keyField]: typed });
      toast('Key saved');
      await rebuild();
    } catch (err) {
      toast(err.message, { error: true });
      saveBtn.disabled = false;
    }
  });

  const removeBtn = info.hasKey
    ? h('button', { type: 'button', class: 'btn danger sm' }, 'Remove key')
    : null;
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      const ok = await confirmBox({
        title: 'Remove this key?',
        message: `Chef Buddy will forget your ${cfg.vendor} key. You can paste it again any time.`,
        okLabel: 'Remove key', danger: true,
      });
      if (!ok) return;
      try {
        await api('DELETE', cfg.removePath);
        toast('Key removed');
        await rebuild();
      } catch (err) {
        toast(err.message, { error: true });
      }
    });
  }

  // Model picker
  const select = h('select', { class: 'field', id: `model-${cfg.modelField}`, 'aria-label': cfg.modelLabel, disabled: true });
  const refreshBtn = h('button', { type: 'button', class: 'btn ghost sm' }, '↻ Refresh');
  const listNote = h('p', { class: 'small' }, info.hasKey ? 'Loading the live model list…' : `Add your ${cfg.vendor} key above to load the model list.`);
  const warning = h('div', { class: 'warn', hidden: true, role: 'alert' });
  const manualInput = h('input', { class: 'field', placeholder: 'e.g. a model id from the vendor docs', 'aria-label': 'Model id', maxlength: '200' });
  const manualBtn = h('button', { type: 'button', class: 'btn ghost sm' }, 'Use this id');

  let current = { models: [], saved: info.model, savedMissing: false, suggested: null };

  const saveModel = async (id) => {
    try {
      await api('PUT', '/settings', { [cfg.modelField]: id });
      toast('Model saved');
      current.saved = id;
      await loadList(false);
    } catch (err) {
      toast(err.message, { error: true });
    }
  };

  function showWarning() {
    const chosen = select.value;
    const model = current.models.find((m) => m.id === chosen);
    let text = '';
    if (current.saved && current.savedMissing && chosen === current.saved) text = 'This model is no longer available. Pick another one.';
    else if (model && model.shutdownDate) text = `This model retires on ${model.shutdownDate}. Pick a new one before then.`;
    warning.hidden = !text;
    warning.textContent = text ? `⚠ ${text}` : '';
  }

  async function loadList(refresh) {
    if (!info.hasKey) return;
    refreshBtn.disabled = true;
    try {
      // The server gives up on the vendor after 15 seconds; we wait a little longer than that.
      const data = await api('GET', `${cfg.modelsPath}${refresh ? '?refresh=1' : ''}`, undefined, { timeout: 25_000 });
      current = data;
      select.replaceChildren();
      if (data.saved && data.savedMissing) select.append(h('option', { value: data.saved }, `${data.saved} (not available)`));
      for (const m of data.models) select.append(h('option', { value: m.id }, m.label));
      select.value = data.saved || data.suggested || '';
      select.disabled = false;
      const updated = new Date(data.fetchedAt).toLocaleString();
      const auto = !data.saved && data.suggested
        ? ` Auto-picked "${(data.models.find((m) => m.id === data.suggested) || {}).label || data.suggested}". Change it if you like.` : '';
      listNote.textContent = `✔ Live list from ${cfg.vendor} · ${cfg.listNote} · updated ${updated}.${auto}`;
      showWarning();
    } catch (err) {
      listNote.textContent = err.message;
    } finally {
      refreshBtn.disabled = false;
    }
  }

  select.addEventListener('change', () => saveModel(select.value));
  refreshBtn.addEventListener('click', () => { if (!mustSaveFirst()) loadList(true); });
  manualBtn.addEventListener('click', () => {
    const id = manualInput.value.trim();
    if (id) saveModel(id).then(() => { manualInput.value = ''; });
  });

  const children = [
    h('h2', null, cfg.title),
    h('label', { class: 'lbl', for: keyInput.id }, cfg.keyLabel),
    h('div', { class: 'keyrow' }, keyInput, testBtn),
    h('div', { class: 'row' }, saveBtn, removeBtn, keyStatus),
    h('p', { class: 'small' }, `${cfg.keyHelp}${info.hasKey ? ' To replace your saved key, paste a new one and press Save key.' : ''}`),
    h('label', { class: 'lbl', for: select.id }, cfg.modelLabel),
    h('div', { class: 'keyrow' }, select, refreshBtn),
    listNote,
    warning,
    h('details', { class: 'more' }, h('summary', null, 'Enter a model id yourself'),
      h('div', { class: 'keyrow' }, manualInput, manualBtn)),
  ];

  if (cfg.hasQuality) {
    const quality = h('select', { class: 'field', id: 'imageQuality', 'aria-label': 'Image quality' },
      QUALITIES.map(([value, label]) => h('option', { value, selected: value === info.quality }, label)));
    quality.addEventListener('change', async () => {
      try {
        await api('PUT', '/settings', { imageQuality: quality.value });
        toast('Image quality saved');
      } catch (err) {
        toast(err.message, { error: true });
      }
    });
    children.push(h('label', { class: 'lbl', for: 'imageQuality' }, 'Image quality'), quality,
      h('p', { class: 'small' }, 'Higher quality costs more of your OpenAI credit per picture.'));
  }

  setChildren(host, children);
  loadList(false);
}
