(() => {
  'use strict';
  const { dishes, halls } = window.CAMPUS_DATA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const key = 'campus-food-v1';
  const ids = new Set(dishes.map((dish) => dish.id));
  let saved = [], reviews = [], persistenceFailed = false;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    saved = Array.isArray(stored.saved) ? [...new Set(stored.saved.filter((id) => ids.has(id)))] : [];
    reviews = Array.isArray(stored.reviews) ? stored.reviews.filter((review) => review && ids.has(review.dishId) && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 && typeof review.text === 'string' && review.text.trim().length >= 5 && review.text.length <= 300 && typeof review.id === 'string' && Number.isFinite(review.createdAt) && review.createdAt >= 0 && review.createdAt <= 8.64e15).slice(0, 200) : [];
  } catch { /* A fresh session still works if browser storage is unavailable. */ }
  const state = { view: 'discover', hall: 'all', category: 'all', price: 'all', query: '', sort: 'recommended', shortcut: '', rank: 'good' };
  const dialog = $('#main-dialog');
  const dialogContent = $('#dialog-content');
  const bookmarkIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h10v14l-5-3-5 3Z"/></svg>';
  let toastTimer, detailId = null, randomLast = null, modalType = '';
  const randomOptions = { budget: '20', spicy: 'all', hall: 'all' };

  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
  }
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify({ saved, reviews }));
      persistenceFailed = false;
      return true;
    } catch {
      persistenceFailed = true;
      toast('浏览器未允许保存；本次操作仅在当前页面保留。');
      return false;
    }
  }
  const findDish = (id) => dishes.find((dish) => dish.id === Number(id));
  const ownReviews = (id) => reviews.filter((review) => review.dishId === id);
  function rating(dish) {
    const local = ownReviews(dish.id);
    return ((dish.rating * dish.reviewCount + local.reduce((sum, review) => sum + review.rating, 0)) / (dish.reviewCount + local.length)).toFixed(1);
  }
  function filterDishes() {
    const query = state.query.trim().toLocaleLowerCase();
    return dishes.filter((dish) => {
      if (state.view === 'saved' && !saved.includes(dish.id)) return false;
      if (state.view === 'new' && !dish.isNew) return false;
      if (state.view === 'ranking' && state.rank === 'caution' && Number(rating(dish)) >= 4) return false;
      if (state.hall !== 'all' && dish.hall !== state.hall) return false;
      if (state.category !== 'all' && dish.category !== state.category) return false;
      if (state.price !== 'all' && dish.price > Number(state.price)) return false;
      if (state.shortcut === 'fast' && dish.wait > 5) return false;
      if (state.shortcut === 'mild' && dish.spicy !== 0) return false;
      return !query || [dish.name, dish.hall, dish.stall, dish.category, ...dish.tags].join(' ').toLocaleLowerCase().includes(query);
    }).sort((a, b) => {
      if (state.view === 'ranking') return state.rank === 'caution' ? Number(rating(a)) - Number(rating(b)) : Number(rating(b)) - Number(rating(a));
      if (state.sort === 'price') return a.price - b.price || Number(rating(b)) - Number(rating(a));
      if (state.sort === 'wait') return a.wait - b.wait || Number(rating(b)) - Number(rating(a));
      return Number(rating(b)) - Number(rating(a)) || b.reviewCount - a.reviewCount;
    });
  }
  function card(dish) {
    const isSaved = saved.includes(dish.id);
    const caution = state.view === 'ranking' && state.rank === 'caution';
    const badge = caution ? '<span class="dish-badge caution">吃前留意</span>' : dish.isNew ? '<span class="dish-badge new">食堂上新</span>' : dish.price <= 12 ? '<span class="dish-badge">平价好味</span>' : '';
    return `<article class="dish-card"><button class="bookmark ${isSaved ? 'saved' : ''}" data-save="${dish.id}" aria-label="${isSaved ? '取消收藏' : '收藏'}${escape(dish.name)}" aria-pressed="${isSaved}">${bookmarkIcon}</button><button class="dish-main" data-dish="${dish.id}" aria-label="查看${escape(dish.name)}详情"><div class="dish-image"><img src="./assets/${dish.image}.jpg" alt="${escape(dish.name)}的食物示意照片" width="900" height="600" loading="lazy">${badge}<span class="image-caption">图片示意</span></div><div class="dish-info"><div class="dish-title-row"><h3>${escape(dish.name)}</h3><span class="rating"><small>★</small>${rating(dish)}</span></div><p class="dish-location">${escape(dish.hall)} · ${escape(dish.floor)}${escape(dish.stall.split('·')[0])}</p><div class="dish-tags">${dish.tags.slice(0, 2).map((tag) => `<span>${escape(tag)}</span>`).join('')}</div><div class="dish-bottom"><span class="dish-price"><small>¥</small>${dish.price}<em>/份</em></span><span class="dish-wait">约${dish.wait}分钟 · ${dish.reviewCount + ownReviews(dish.id).length}条点评</span></div>${caution ? `<p class="dish-caution">${escape(dish.caution)}</p>` : ''}</div></button></article>`;
  }
  function render() {
    const titles = {
      discover: ['THE CAMPUS MENU', '食堂里，藏着这些好吃的'],
      ranking: ['THE CAMPUS PICKS', state.rank === 'caution' ? '避雷手账，先看原因再决定' : '这一口，值得专程去一趟'],
      new: ['SOMETHING NEW', '换个口味，尝尝食堂新菜'],
      saved: ['YOUR FOOD NOTES', '先收藏，下次就吃这家']
    };
    $('#section-overline').textContent = titles[state.view][0];
    $('#section-title').innerHTML = `${titles[state.view][1]}<span class="title-dot">.</span>`;
    const result = filterDishes();
    $('#results-count').textContent = `${result.length} 道菜品`;
    $('#rank-switch').hidden = state.view !== 'ranking';
    $('#sort-filter').disabled = state.view === 'ranking';
    $$('.nav-item').forEach((button) => {
      const selected = button.dataset.view === state.view;
      button.classList.toggle('active', selected);
      selected ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
    });
    $$('[data-hall]').forEach((button) => { button.classList.toggle('selected', button.dataset.hall === state.hall); button.setAttribute('aria-pressed', String(button.dataset.hall === state.hall)); });
    $$('[data-rank]').forEach((button) => { button.classList.toggle('selected', button.dataset.rank === state.rank); button.setAttribute('aria-pressed', String(button.dataset.rank === state.rank)); });
    $('#saved-count').textContent = saved.length || '';
    const filters = [];
    if (state.hall !== 'all') filters.push(state.hall);
    if (state.category !== 'all') filters.push(state.category);
    if (state.price !== 'all') filters.push(`${state.price}元以内`);
    if (state.query.trim()) filters.push(`搜索“${state.query.trim()}”`);
    if (state.shortcut === 'fast') filters.push('5分钟内出餐');
    if (state.shortcut === 'mild') filters.push('不辣');
    $('#active-filter').hidden = !filters.length;
    $('#active-filter-text').textContent = filters.join(' · ');
    if (result.length) $('#dish-grid').innerHTML = result.map(card).join('');
    else {
      const noSaved = state.view === 'saved' && !saved.length;
      $('#dish-grid').innerHTML = `<div class="empty-state"><div class="empty-symbol">${noSaved ? '⌑' : '∅'}</div><h3>${noSaved ? '把想吃的，先记在这里' : '这次还没有找到合适的菜'}</h3><p>${noSaved ? '点一下菜品右上角的收藏按钮，<br>下次饭点就不用从头找。' : '换个食堂，或放宽一点预算再看看。'}</p><button class="button outline" data-action="${noSaved ? 'discover' : 'clear'}">${noSaved ? '去发现好吃的' : '清除筛选条件'}</button></div>`;
    }
    $('#menu-end').hidden = !result.length;
  }
  function resetFilters() {
    Object.assign(state, { hall: 'all', category: 'all', price: 'all', query: '', sort: 'recommended', shortcut: '' });
    $('#search-input').value = '';
    $('#category-filter').value = 'all';
    $('#price-filter').value = 'all';
    $('#sort-filter').value = 'recommended';
  }
  function navigate(view) {
    state.view = view;
    state.rank = 'good';
    resetFilters();
    render();
    $('#explore').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function toggleSaved(id) {
    const dish = findDish(id);
    if (!dish) return;
    const restoreFocus = document.activeElement?.dataset.save === String(dish.id);
    const focusInDialog = dialog.contains(document.activeElement);
    const wasSaved = saved.includes(dish.id);
    saved = wasSaved ? saved.filter((value) => value !== dish.id) : [...saved, dish.id];
    const persisted = persist();
    render();
    if (modalType === 'detail' && detailId === dish.id) openDetail(dish.id, true);
    if (restoreFocus) {
      const nextFocus = focusInDialog ? dialog.querySelector(`[data-save="${dish.id}"]`) : $(`#dish-grid [data-save="${dish.id}"]`) || $('#dish-grid .empty-state button') || $('.nav-item.active');
      nextFocus?.focus({ preventScroll: true });
    }
    if (persisted) toast(wasSaved ? '已取消收藏' : '已收藏，下次饭点在「我的收藏」里找。');
  }
  function openModal(html, label, type) {
    modalType = type;
    dialogContent.innerHTML = html;
    dialog.setAttribute('aria-label', label);
    if (!dialog.open) dialog.showModal();
    else dialog.querySelector('.dialog-close').focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    dialog.scrollTop = 0;
  }
  function closeModal() {
    dialog.close();
    document.body.style.overflow = '';
    modalType = '';
  }
  function reviewHTML(review, local = false) {
    const name = local ? '我' : review.author;
    const time = local ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(review.createdAt)) : '示例点评';
    return `<article class="review-item"><div class="review-meta"><span class="avatar" aria-hidden="true">${escape(name.slice(0, 1))}</span><span class="review-person"><strong>${escape(name)} ${local ? '<span class="local-badge">仅本机</span>' : ''}</strong><small>${escape(time)}</small></span><span class="review-stars" aria-label="${review.rating}星">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span></div><p>${escape(review.text)}</p>${local ? `<button class="review-delete" data-delete-review="${escape(review.id)}">删除我的这条点评</button>` : ''}</article>`;
  }
  function openDetail(id, keepPosition = false) {
    const dish = findDish(id);
    if (!dish) return;
    detailId = dish.id;
    const scroll = dialog.scrollTop;
    const local = ownReviews(dish.id);
    openModal(`<div class="detail-hero"><div class="detail-photo"><img src="./assets/${dish.image}.jpg" alt="${escape(dish.name)}的食物示意照片"><span>食物照片仅作示意</span></div><div class="detail-summary"><p class="modal-eyebrow">这一口，了解一下</p><h2>${escape(dish.name)}</h2><p class="location">${escape(dish.hall)} · ${escape(dish.floor)}<br>${escape(dish.stall)}</p><div class="detail-rating"><span class="rating">★ ${rating(dish)}</span><span>${dish.reviewCount}条示例点评${local.length ? ` + ${local.length}条本机点评` : ''}</span></div><div class="detail-price">¥${dish.price} <small>/ 份</small></div><div class="dish-tags">${dish.tags.map((tag) => `<span>${escape(tag)}</span>`).join('')}</div></div></div><div class="dialog-pad"><div class="detail-facts"><div><strong>${['不辣', '微辣', '中辣'][dish.spicy]}</strong><small>示例口味</small></div><div><strong>约${dish.wait}分钟</strong><small>示例等待时间</small></div><div><strong>${dish.category}</strong><small>菜品类型</small></div></div><div class="recommend-note"><strong>值得一试</strong><span>${escape(dish.note)}</span></div><div class="recommend-note warning"><strong>吃前留意</strong><span>${escape(dish.caution)}</span></div><div class="detail-actions"><button class="button primary" data-action="review" data-review-dish="${dish.id}">我也吃过，写点评</button><button class="button outline" data-save="${dish.id}" aria-pressed="${saved.includes(dish.id)}">${saved.includes(dish.id) ? '已收藏 · 取消收藏' : '收藏，下次吃'}</button></div><div class="review-heading"><h3>这一口怎么说</h3><span>示例内容 + 你的本机记录</span></div>${local.map((review) => reviewHTML(review, true)).join('')}${dish.reviews.map((review) => reviewHTML(review)).join('')}<p class="detail-fineprint">当前为示例校园。评分基于演示数据，展示的示例点评为部分内容。你的评分会参与当前浏览器的评分计算，其他访客无法看到本机点评。</p></div>`, `${dish.name}详情`, 'detail');
    if (keepPosition) dialog.scrollTop = scroll;
  }
  function openReview(id) {
    const selected = findDish(id);
    openModal(`<div class="dialog-pad"><p class="modal-eyebrow">YOUR CAMPUS FOOD NOTES</p><h2 class="dialog-title">吃过这一口，留下几句话。</h2><p class="dialog-subtitle">口味、分量、等待时间，具体一点就很有用。</p><form id="review-form"><div class="form-field"><label class="field-label" for="review-dish">你吃的是哪一道？</label><select class="form-select" id="review-dish" name="dishId" required>${dishes.map((dish) => `<option value="${dish.id}" ${dish.id === selected?.id ? 'selected' : ''}>${escape(dish.name)} · ${escape(dish.hall)}</option>`).join('')}</select></div><div class="form-field"><fieldset style="border:0;padding:0;margin:0"><legend class="field-label">这一顿，你打几分？</legend><div class="score-picker">${['不推荐', '有点失望', '还行', '值得吃', '会再来'].map((label, index) => `<label><input type="radio" name="rating" value="${index + 1}" ${index === 3 ? 'checked' : ''} required><span>${index + 1}<small>${label}</small></span></label>`).join('')}</div></fieldset></div><div class="form-field"><label class="field-label" for="review-text">说说这顿吃得怎么样</label><textarea class="review-textarea" id="review-text" name="text" minlength="5" maxlength="300" placeholder="比如：鸡肉给得挺足，酱汁稍咸；12点去排了8分钟。" required></textarea><div class="counter-row"><span id="review-error" role="alert">至少5个字，记点有用的。</span><span id="review-counter">0 / 300</span></div></div><p class="form-disclaimer">这一版的点评仅保存在当前浏览器，不会上传，也不会被其他访客看到。清除浏览器数据会清除记录。</p><button class="button primary form-submit" type="submit">保存我的点评</button></form></div>`, '写一条点评', 'review');
  }
  function submitReview(form) {
    const values = new FormData(form);
    const text = String(values.get('text') || '').trim();
    const dish = findDish(values.get('dishId'));
    const score = Number(values.get('rating'));
    if (!dish || !Number.isInteger(score) || score < 1 || score > 5 || text.length < 5 || text.length > 300) {
      $('#review-error').textContent = '请选一道菜，并写下5—300个字的具体感受。';
      $('#review-error').classList.add('form-error');
      return;
    }
    if (reviews.length >= 200) { toast('本机已保存200条点评，请先删除一些旧记录。'); return; }
    const createdAt = Date.now();
    reviews.unshift({ id: `${createdAt}-${Math.random().toString(36).slice(2, 9)}`, dishId: dish.id, rating: score, text, createdAt });
    persist();
    render();
    openDetail(dish.id);
    if (!persistenceFailed) toast('点评已保存在本机。');
  }
  function openRandom() {
    randomLast = null;
    openModal(`<div class="dialog-pad"><p class="modal-eyebrow">LEAVE THE CHOICE TO CHANCE</p><h2 class="dialog-title">这一顿，帮你选。</h2><p class="dialog-subtitle">先划个范围，再从口碑4分以上的菜里挑一道。</p><form id="random-form"><div class="random-form"><label><span class="field-label">这一顿的预算</span><select name="budget" class="form-select"><option value="12">12元以内</option><option value="15">15元以内</option><option value="20">20元以内</option><option value="all">不设上限</option></select></label><label><span class="field-label">今天的口味</span><select name="spicy" class="form-select"><option value="all">都可以</option><option value="0">不吃辣</option><option value="1">最多微辣</option></select></label><label><span class="field-label">想去哪个食堂</span><select name="hall" class="form-select"><option value="all">都可以</option>${halls.map((hall) => `<option>${escape(hall)}</option>`).join('')}</select></label></div><button class="button primary form-submit" type="submit" id="random-submit">就按这个，帮我选 ↗</button></form><div id="random-output" aria-live="polite"></div><p class="detail-fineprint">基于示例菜品，按条件随机选择，不含付费推广。</p></div>`, '帮我选一顿', 'random');
    Object.entries(randomOptions).forEach(([name, value]) => { $(`#random-form [name="${name}"]`).value = value; });
  }
  function chooseRandom() {
    const values = new FormData($('#random-form'));
    Object.keys(randomOptions).forEach((name) => { randomOptions[name] = String(values.get(name)); });
    const candidates = dishes.filter((dish) => Number(rating(dish)) >= 4 && (randomOptions.budget === 'all' || dish.price <= Number(randomOptions.budget)) && (randomOptions.spicy === 'all' || dish.spicy <= Number(randomOptions.spicy)) && (randomOptions.hall === 'all' || dish.hall === randomOptions.hall));
    if (!candidates.length) {
      $('#random-output').innerHTML = '<p class="random-empty">这个范围里暂时没有合适的菜。试试提高一点预算，或换成「全部食堂」。</p>';
      randomLast = null;
      return;
    }
    const pool = candidates.length > 1 ? candidates.filter((dish) => dish.id !== randomLast) : candidates;
    const dish = pool[Math.floor(Math.random() * pool.length)];
    randomLast = dish.id;
    $('#random-output').innerHTML = `<div class="random-result"><div class="random-result-main"><img src="./assets/${dish.image}.jpg" alt="${escape(dish.name)}的食物示意图"><div><span class="random-result-label">${candidates.length === 1 ? '符合条件的只有这一道' : '今天就去吃这道吧'}</span><h3>${escape(dish.name)}</h3><p>${escape(dish.hall)} · ${escape(dish.floor)}${escape(dish.stall.split('·')[0])}</p><p>¥${dish.price} / 份 · ★ ${rating(dish)} · 约${dish.wait}分钟</p><p>${escape(dish.note)}</p></div></div><div class="random-actions"><button class="button outline" data-action="reroll">${candidates.length === 1 ? '查看当前条件' : '再换一道'}</button><button class="button primary" data-dish="${dish.id}">看看详情和点评 ↗</button></div></div>`;
    $('#random-submit').textContent = '更新条件，重新选 ↗';
  }
  function openAbout() {
    openModal('<div class="dialog-pad"><p class="modal-eyebrow">ABOUT THIS EDITION</p><h2 class="dialog-title">先把这一顿，安排明白。</h2><div class="about-copy"><p>「今天吃哪口」是一个校园食堂点评推荐工具的产品体验版。你可以筛选菜品、看具体点评、记录收藏，也可以让选餐工具帮你决定。</p><p><strong>校园和数据均为示例。</strong><br>南湖大学、食堂、窗口、菜价、评分、等餐时间与点评都是为演示设计的内容，不代表真实学校或商户。食物图片仅用于示意，不是对应菜品的实拍。</p><p><strong>你的记录只留在当前浏览器。</strong><br>无需登录。收藏和你写的点评保存在本机，刷新后仍可查看；换设备、使用隐私窗口或清理浏览器数据后无法同步。此版本尚未接入共享数据库。</p><p><strong>后续可以接入真实校园。</strong><br>替换学校与窗口资料、补充实拍菜图、连接共享点评后，就能逐步用于真实场景。</p><p>食物示意图来自 <a href="https://unsplash.com/" target="_blank" rel="noopener noreferrer">Unsplash</a>。</p></div><button class="button dark form-submit" data-action="close">明白了，去逛食堂</button></div>', '使用说明与演示范围', 'about');
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.save) { toggleSaved(target.dataset.save); return; }
    if (target.dataset.dish) { openDetail(target.dataset.dish); return; }
    if (target.dataset.view) { navigate(target.dataset.view); return; }
    if (target.dataset.hall) { state.hall = target.dataset.hall; render(); return; }
    if (target.dataset.rank) { state.rank = target.dataset.rank; render(); return; }
    if (target.dataset.shortcut) {
      navigate('discover');
      if (target.dataset.shortcut === 'budget') { state.price = '12'; $('#price-filter').value = '12'; }
      else state.shortcut = target.dataset.shortcut;
      render();
      return;
    }
    if (target.dataset.deleteReview) {
      reviews = reviews.filter((review) => review.id !== target.dataset.deleteReview);
      const persisted = persist();
      render();
      openDetail(detailId, true);
      if (persisted) toast('已删除这条本机点评。');
      return;
    }
    switch (target.dataset.action) {
      case 'close': closeModal(); break;
      case 'review': openReview(target.dataset.reviewDish); break;
      case 'random': openRandom(); break;
      case 'reroll': if ($('#random-output .random-result-label')?.textContent.includes('只有')) $('#random-form select').focus(); else chooseRandom(); break;
      case 'about': openAbout(); break;
      case 'clear': resetFilters(); render(); break;
      case 'discover': navigate('discover'); break;
      case 'caution': navigate('ranking'); state.rank = 'caution'; render(); break;
    }
  });
  document.addEventListener('submit', (event) => {
    if (event.target.id === 'review-form') { event.preventDefault(); submitReview(event.target); }
    if (event.target.id === 'random-form') { event.preventDefault(); chooseRandom(); }
  });
  $('#search-input').addEventListener('input', (event) => { state.query = event.target.value; render(); });
  [['#category-filter', 'category'], ['#price-filter', 'price'], ['#sort-filter', 'sort']].forEach(([selector, name]) => $(selector).addEventListener('change', (event) => { state[name] = event.target.value; render(); }));
  document.addEventListener('input', (event) => {
    if (event.target.id === 'review-text') { $('#review-counter').textContent = `${event.target.value.length} / 300`; $('#review-error').classList.remove('form-error'); }
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; modalType = ''; });
  dialog.addEventListener('cancel', () => { document.body.style.overflow = ''; modalType = ''; });
  document.addEventListener('error', (event) => {
    if (event.target instanceof HTMLImageElement && !event.target.dataset.fallback) { event.target.dataset.fallback = 'true'; event.target.src = './assets/rice.jpg'; }
  }, true);
  $('#budget-list').innerHTML = dishes.filter((dish) => dish.price <= 12 && Number(rating(dish)) >= 4).sort((a, b) => a.price - b.price).slice(0, 3).map((dish) => `<button class="budget-item" data-dish="${dish.id}"><img src="./assets/${dish.image}.jpg" alt="" loading="lazy"><span><strong>${escape(dish.name)}</strong><small>${escape(dish.hall)} · ${dish.wait}分钟出餐</small></span><b>¥${dish.price}</b></button>`).join('');
  render();
})();
