// ==UserScript==
// @name         杭电研究生一键评教
// @namespace    https://github.com/junshanxu/hdu-graduate-evaluation
// @version      1.0.0
// @description  在当前评教列表中逐份按各题上限填写并提交
// @match        https://yjsfw.hdu.edu.cn/gsapp/sys/jxpgapp/*
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/junshanxu/hdu-graduate-evaluation
// @supportURL   https://github.com/junshanxu/hdu-graduate-evaluation/issues
// @downloadURL  https://raw.githubusercontent.com/junshanxu/hdu-graduate-evaluation/main/hdu-evaluation.user.js
// @updateURL    https://raw.githubusercontent.com/junshanxu/hdu-graduate-evaluation/main/hdu-evaluation.user.js
// ==/UserScript==

(() => {
  'use strict';
  const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const shown = selector => Array.from(document.querySelectorAll(selector)).filter(visible);
  const pending = () => shown('label.pjzt-tag-dp').filter(el => el.textContent.trim() === '待评教');
  const scores = () => shown('input.inputScore');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(read, reason) {
    const deadline = Date.now() + 15000;
    do {
      const result = read();
      if (result) return result;
      await sleep(150);
    } while (Date.now() < deadline);
    throw new Error(reason);
  }
  function count(label) {
    const match = document.body.innerText.match(new RegExp(label + '[（(]\\s*(\\d+)\\s*[)）]'));
    return match ? Number(match[1]) : null;
  }
  function teacher(label) {
    return label.closest('.sc-panel-thingNoImg-1-subject')?.querySelector('[title]')?.title.trim();
  }
  function readMax(input) {
    const match = input.placeholder.match(/^打分范围[：:]\s*0\s*[—–－-]\s*(\d+)\s*$/);
    if (!match) throw new Error('无法识别评分范围：' + input.placeholder);
    return Number(match[1]);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '一键满分评教';
  button.style.cssText = 'position:fixed;bottom:16px;right:24px;z-index:99999;padding:8px 14px;cursor:pointer';
  // 仅在列表页显示入口。问卷和列表由同一页面动态切换。
  let running = false;
  function update() {
    button.hidden = !running && (count('待评') === null || scores().length > 0);
  }
  button.onclick = async () => {
    if (running) return;
    const total = count('待评');
    if (total === 0) return alert('待评 0 位。');
    const initialDone = count('已评');
    const names = pending().map(teacher);
    if (initialDone === null || total !== names.length || !names.every(Boolean) || new Set(names).size !== total) {
      return alert('无法逐一核对当前列表与待评总数。请清除筛选，并将每页显示数量调至可显示全部待评教师。同名条目需人工处理。');
    }
    if (!confirm('给以下 ' + total + ' 位教师逐项打满分并提交？\n' + names.join('、'))) return;
    running = true;
    button.disabled = true;
    let done = 0;
    let current = '';
    try {
      for (const name of names) {
        current = name;
        button.textContent = '正在评教：' + name;
        const matches = pending().filter(el => teacher(el) === name);
        if (matches.length !== 1) throw new Error('待评列表已变化');
        matches[0].click();
        const inputs = await waitFor(() => scores().length === 17 && scores(), '未找到已知的 17 项评分问卷');
        const maxima = inputs.map(readMax);
        if (maxima.reduce((a, b) => a + b, 0) !== 100) throw new Error('问卷满分与预期的 100 分不符');
        inputs.forEach((input, i) => {
          input.focus();
          input.value = String(maxima[i]);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.blur();
        });
        if (!inputs.every((input, i) => input.value === String(maxima[i]))) throw new Error('分项核对失败');
        const submit = shown('a').filter(el => el.textContent.trim() === '提交');
        if (submit.length !== 1) throw new Error('无法定位提交按钮');
        submit[0].click();
        await waitFor(() => !scores().length && count('已评') === initialDone + done + 1 &&
          count('待评') === total - done - 1 && !pending().some(el => teacher(el) === name),
          '平台尚未返回预期的已评和待评状态，请查看页面提示并核对结果');
        done++;
      }
      alert('已核实提交 ' + done + ' 份，待评 0 位。');
    } catch (error) {
      alert('已核实完成 ' + done + ' 份。处理「' + current + '」时停止：' + error.message);
    } finally {
      running = false;
      button.disabled = false;
      button.textContent = '一键满分评教';
      update();
    }
  };
  document.body.appendChild(button);
  update();
  new MutationObserver(update).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
