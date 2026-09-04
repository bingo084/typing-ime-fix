// ==UserScript==
// @name         Fcitx5 IME Fix for Chinese Typing Trainers
// @name:zh-CN   中文跟打器 Fcitx5 IME 兼容补偿
// @namespace    https://github.com/bingo084
// @version      1.0.0
// @description  Fix missing keystrokes and completion checks caused by Fcitx5 sentence composition on supported Chinese typing trainers.
// @description:zh-CN 补偿 Fcitx5 整句输入时被浏览器隐藏的击键，修复受支持中文跟打器的码长统计和完成检查。
// @license      MIT
// @match        https://www.tiger-code.com/practice/health/type*
// @match        https://typer.owenyang.top/*
// @compatible   chrome Tested on Arch Linux with Fcitx5-Rime
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const adapters = [
    {
      id: 'tiger-code',
      matchesPage: () =>
        location.hostname === 'www.tiger-code.com' &&
        location.pathname.startsWith('/practice/health/type'),
      matchesInput: (target) =>
        target instanceof HTMLInputElement &&
        target.placeholder === '在这里输入文字',
      siteCountsKey: (event) =>
        event.key === 'F14' ||
        event.key === 'Process' ||
        (event.key.length === 1 && /^[\x20-\x7e]$/.test(event.key)),
      checkFinishedAfterComposition: false,
    },
    {
      id: 'muyityper',
      matchesPage: () => location.hostname === 'typer.owenyang.top',
      matchesInput: (target) =>
        target instanceof HTMLTextAreaElement &&
        target.id === 'racing-textarea',
      // 木易在已经开始跟打后会把每个 keydown 都加入 keyCount。
      siteCountsKey: () => true,
      checkFinishedAfterComposition: true,
    },
  ];

  const adapter = adapters.find((candidate) => candidate.matchesPage());
  if (!adapter) return;

  let composing = false;
  let activeInput = null;
  let previousCompositionText = '';
  let pendingTrustedKeydowns = [];
  let lastCompositionUpdateAt = Number.NEGATIVE_INFINITY;

  const KEYDOWN_MATCH_WINDOW_MS = 120;
  const SAME_PHYSICAL_KEY_WINDOW_MS = 16;

  const stats = {
    version: '1.0.0',
    site: adapter.id,
    trustedCounted: 0,
    compositionUpdates: 0,
    matched: 0,
    supplemented: 0,
    supplementedCommit: 0,
  };

  function consumeRecentTrustedKeydown(now) {
    pendingTrustedKeydowns = pendingTrustedKeydowns.filter(
      (timestamp) => now - timestamp <= KEYDOWN_MATCH_WINDOW_MS,
    );
    if (pendingTrustedKeydowns.length === 0) return false;

    pendingTrustedKeydowns.shift();
    return true;
  }

  function supplementKeydown(input, reason) {
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Process',
        code: 'Unidentified',
        isComposing: true,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );

    stats.supplemented += 1;
    if (reason === 'commit') stats.supplementedCommit += 1;
  }

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        !event.isTrusted ||
        !adapter.matchesInput(event.target) ||
        !adapter.siteCountsKey(event)
      ) {
        return;
      }

      pendingTrustedKeydowns.push(performance.now());
      stats.trustedCounted += 1;
    },
    true,
  );

  document.addEventListener(
    'compositionstart',
    (event) => {
      if (!adapter.matchesInput(event.target)) return;

      composing = true;
      activeInput = event.target;
      previousCompositionText = '';
    },
    true,
  );

  document.addEventListener(
    'compositionupdate',
    (event) => {
      if (!composing || event.target !== activeInput) return;

      const currentText = typeof event.data === 'string' ? event.data : '';
      const now = performance.now();

      stats.compositionUpdates += 1;

      if (consumeRecentTrustedKeydown(now)) {
        stats.matched += 1;
      } else {
        // 虎码整句在分段、组句和候选替换时也会让 composition data 变短，
        // 因此不能用字符串长度变化推断 Backspace。
        supplementKeydown(activeInput, 'compositionupdate');
      }

      previousCompositionText = currentText;
      lastCompositionUpdateAt = now;
    },
    true,
  );

  document.addEventListener(
    'compositionend',
    (event) => {
      if (!composing || event.target !== activeInput) return;

      const now = performance.now();
      const countedCommitKey = consumeRecentTrustedKeydown(now);
      const followsCompositionUpdate =
        now - lastCompositionUpdateAt <= SAME_PHYSICAL_KEY_WINDOW_MS;

      // 单独的空格/选重键若只产生 compositionend，则补计一次；若刚刚已经
      // 有一次 compositionupdate，则视为同一物理键导致的自动上屏，不重复补。
      if (
        !countedCommitKey &&
        !followsCompositionUpdate &&
        (previousCompositionText || event.data)
      ) {
        supplementKeydown(activeInput, 'commit');
      }

      const finishedInput = activeInput;
      const committedText = event.data || null;
      composing = false;
      activeInput = null;
      previousCompositionText = '';
      pendingTrustedKeydowns = [];
      lastCompositionUpdateAt = Number.NEGATIVE_INFINITY;

      if (adapter.checkFinishedAfterComposition) {
        // Element UI 可能在 compositionend 后才把 textarea.value 同步到
        // Vue/Vuex。下一轮先补发 input，再触发网站原有的 keyup 完成检查。
        window.setTimeout(() => {
          finishedInput.dispatchEvent(
            new InputEvent('input', {
              data: committedText,
              inputType: 'insertCompositionText',
              isComposing: false,
              bubbles: true,
              composed: true,
            }),
          );
          finishedInput.dispatchEvent(
            new KeyboardEvent('keyup', {
              key: 'Process',
              code: 'Unidentified',
              isComposing: false,
              bubbles: true,
              cancelable: true,
              composed: true,
            }),
          );
        }, 0);
      }

    },
    true,
  );

  // 在开发者工具控制台输入 __typingImeFix 可查看累计补偿情况。
  Object.defineProperty(window, '__typingImeFix', {
    value: stats,
    configurable: true,
  });
})();
