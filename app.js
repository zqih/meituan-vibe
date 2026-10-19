(() => {
  'use strict';
  const { dishes } = window.CAMPUS_DATA;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const key = 'campus-food-v1';
  const ids = new Set(dishes.map((dish) => dish.id));
  const validDate = (time) => Number.isFinite(time) && time >= 0 && time <= 8.64e15;
  let saved = [], reviews = [];
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    saved = Array.isArray(stored.saved) ? [...new Set(stored.saved.filter((id) => ids.has(id)))] : [];
    reviews = Array.isArray(stored.reviews) ? stored.reviews.filter((r) => r && ids.has(r.dishId) && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 && typeof r.text === 'string' && r.text.trim().length >= 5 && r.text.length <= 300 && typeof r.id === 'string' && validDate(r.createdAt)).slice(0,200) : [];
  } catch { /* Continue without stored records when browser storage is unavailable. */ }
  const state = { view:'discover', hall:'all', price:'all', category:'all', spicy:'all', query:'', sort:'recommended', fast:false, limit:6 };
  let lastView = 'discover', detailId = null, modalType = '', randomLast = null, modalOpener = null, toastTimer;
  const dialog = $('#main-dialog');
  const content = $('#dialog-content');
  const bookmarkIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4Z"/></svg>';
  function syncControls() {
    ['hall','price','category','spicy','sort'].forEach((name) => { $('#'+name+'-filter').value=state[name]; });
    if ($('#search-input').value!==state.query) $('#search-input').value=state.query;
    $('#fast-filter').checked=state.fast;
  }
  function restoreURL() {
    const params=new URLSearchParams(window.location.search);
    const allowed={view:['discover','new','caution','saved'],hall:['all',...new Set(dishes.map(d=>d.hall))],price:['all','12','15','20'],category:['all',...new Set(dishes.map(d=>d.category))],spicy:['all','0','1'],sort:['recommended','price','wait']};
    const defaults={view:'discover',hall:'all',price:'all',category:'all',spicy:'all',sort:'recommended'};
    for(const [name,options] of Object.entries(allowed)){const value=params.get(name);state[name]=options.includes(value)?value:defaults[name];}
    if(params.get('view')==='ranking')state.view=params.get('rank')==='caution'?'caution':'discover';
    state.query=(params.get('q')||'').slice(0,200);
    state.fast=params.get('fast')==='1'||params.get('shortcut')==='fast';
    if(params.get('shortcut')==='mild'&&!params.has('spicy'))state.spicy='0';
    state.limit=6;
    syncControls();
  }
  function syncURL(push) {
    const url=new URL(window.location.href);
    const defaults={view:'discover',hall:'all',price:'all',category:'all',spicy:'all',sort:'recommended'};
    for(const [name,value] of Object.entries(defaults)){if(state[name]===value)url.searchParams.delete(name);else url.searchParams.set(name,state[name]);}
    if(state.query)url.searchParams.set('q',state.query);else url.searchParams.delete('q');
    if(state.fast)url.searchParams.set('fast','1');else url.searchParams.delete('fast');
    url.searchParams.delete('rank');url.searchParams.delete('shortcut');
    if(url.href!==window.location.href)window.history[push?'pushState':'replaceState'](null,'',url);
  }
  const findDish = (id) => dishes.find((d) => d.id === Number(id));
  const ownReviews = (id) => reviews.filter((r) => r.dishId === id);
  function rating(dish) {
    const local = ownReviews(dish.id);
    return ((dish.rating * dish.reviewCount + local.reduce((sum,r) => sum+r.rating,0)) / (dish.reviewCount+local.length)).toFixed(1);
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'),3000);
  }
  function persist() {
    try { localStorage.setItem(key,JSON.stringify({saved,reviews})); return true; }
    catch { toast('浏览器不允许保存，记录仅在当前页面保留。'); return false; }
  }
  function filterDishes() {
    const query = state.query.trim().toLowerCase();
    return dishes.filter((d) =>
      (state.view !== 'saved' || saved.includes(d.id)) &&
      (state.view !== 'new' || d.isNew) &&
      (state.view !== 'caution' || Number(rating(d)) < 4) &&
      (state.hall === 'all' || d.hall === state.hall) &&
      (state.price === 'all' || d.price <= Number(state.price)) &&
      (state.category === 'all' || d.category === state.category) &&
      (state.spicy === 'all' || d.spicy <= Number(state.spicy)) &&
      (!state.fast || d.wait <= 5) &&
      (!query || [d.name,d.hall,d.stall,d.category,...d.tags].join(' ').toLowerCase().includes(query))
    ).sort((a,b) => {
      if (state.sort === 'price') return a.price-b.price || Number(rating(b))-Number(rating(a));
      if (state.sort === 'wait') return a.wait-b.wait || Number(rating(b))-Number(rating(a));
      return state.view === 'caution' ? Number(rating(a))-Number(rating(b)) : Number(rating(b))-Number(rating(a)) || b.reviewCount-a.reviewCount;
    });
  }
  function card(dish) {
    const selected = saved.includes(dish.id);
    return '<article class="dish-card">' +
      '<button class="bookmark '+(selected?'saved':'')+'" data-save="'+dish.id+'" aria-label="'+(selected?'取消收藏':'收藏')+escape(dish.name)+'" aria-pressed="'+selected+'">'+bookmarkIcon+'</button>' +
      '<button class="dish-main" data-dish="'+dish.id+'" aria-label="查看'+escape(dish.name)+'详情">' +
      '<div class="dish-image"><img src="./assets/'+dish.image+'.jpg" alt="'+escape(dish.name)+'的食物示意图" width="900" height="600" loading="lazy"></div>' +
      '<div class="dish-info"><div class="dish-title-row"><h2>'+escape(dish.name)+'</h2><span class="dish-price"><small>¥</small>'+dish.price+'</span></div>' +
      '<div class="dish-meta"><span>'+escape(dish.hall)+' · '+escape(dish.stall.split('·')[0])+'</span><span class="rating"><small>★</small>'+rating(dish)+'</span></div>' +
      (state.view==='caution'?'<p class="dish-caution">'+escape(dish.caution)+'</p>':'')+'</div></button></article>';
  }
  function render(pushHistory=false) {
    syncControls();syncURL(pushHistory);
    $('#section-title').textContent = ({discover:'今天吃什么？',new:'食堂新菜',caution:'吃前看一眼',saved:'我的收藏'})[state.view];
    $('.menu-tabs').hidden = state.view === 'saved';
    $('#back-to-menu').hidden = state.view !== 'saved';
    $('#pick-button').hidden = state.view === 'caution';
    $$('.menu-tabs [data-view]').forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('active',active);
      active ? button.setAttribute('aria-current','page') : button.removeAttribute('aria-current');
    });
    $('.saved-nav').setAttribute('aria-pressed',String(state.view==='saved'));
    $('#saved-count').textContent = saved.length ? '('+saved.length+')' : '';
    const extra = [];
    if (state.query.trim()) extra.push('搜索“'+state.query.trim()+'”');
    if (state.category !== 'all') extra.push(state.category);
    if (state.spicy !== 'all') extra.push(state.spicy==='0'?'不辣':'最多微辣');
    if (state.fast) extra.push('5分钟内出餐');
    if (state.sort !== 'recommended') extra.push(state.sort==='price'?'低价优先':'出餐最快');
    $('#filter-count').hidden = !extra.length;
    $('#filter-count').textContent = extra.length;
    $('#filter-status').hidden = !extra.length || !$('#extra-filters').hidden;
    $('#filter-status').textContent = extra.join(' · ');
    $('#sort-filter option[value="recommended"]').textContent = state.view==='caution'?'评分从低到高':'评分优先';
    const result = filterDishes();
    const shown = result.slice(0,state.limit);
    if (result.length) $('#dish-grid').innerHTML = shown.map(card).join('');
    else {
      const noSaved = state.view==='saved' && !saved.length;
      $('#dish-grid').innerHTML = '<div class="empty-state"><h2>'+(noSaved?'还没有收藏':'没有符合条件的菜')+'</h2><p>'+(noSaved?'点菜品右上角的收藏按钮，下次来这里找。':'换个食堂，或放宽筛选条件再看看。')+'</p><button class="button secondary" data-action="'+(noSaved?'discover':'clear')+'">'+(noSaved?'去看看菜品':'清除筛选')+'</button></div>';
    }
    $('#show-more').hidden = result.length <= shown.length;
    $('#show-more').textContent = '查看其余'+(result.length-shown.length)+'道菜';
    $('#results-count').textContent = result.length && result.length<=shown.length ? '共'+result.length+'道菜' : '';
  }
  function resetFilters() {
    Object.assign(state,{hall:'all',price:'all',category:'all',spicy:'all',query:'',sort:'recommended',fast:false,limit:6});
    ['hall','price','category','spicy'].forEach((name) => $('#'+name+'-filter').value='all');
    $('#search-input').value='';
    $('#sort-filter').value='recommended';
    $('#fast-filter').checked=false;
  }
  function navigate(view) {
    if (view==='saved' && state.view==='saved') view=lastView;
    if (view==='saved') lastView=state.view;
    state.view=view;
    state.limit=6;
    render(true);
    $('#section-title').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function setFiltersOpen(open,focus=false) {
    $('#extra-filters').hidden=!open;
    $('#filter-toggle').setAttribute('aria-expanded',String(open));
    render();
    if(focus && open) $('#search-input').focus({preventScroll:true});
  }
  function openModal(html,label,type) {
    if (!dialog.open) modalOpener=document.activeElement;
    modalType=type;
    content.innerHTML=html;
    dialog.setAttribute('aria-label',label);
    if(!dialog.open)dialog.showModal();
    else $('.dialog-close').focus({preventScroll:true});
    document.body.style.overflow='hidden';
    dialog.scrollTop=0;
  }
  function closeModal() { dialog.close(); }
  function restoreModalFocus() {
    document.body.style.overflow='';
    modalType='';
    const target=modalOpener?.isConnected?modalOpener:$('#dish-grid [data-dish="'+detailId+'"]')||$('#pick-button');
    target?.focus({preventScroll:true});
  }
  function toggleSaved(id) {
    const dish=findDish(id);if(!dish)return;
    const had=saved.includes(dish.id);
    const restore=document.activeElement?.dataset.save===String(dish.id);
    const inside=dialog.contains(document.activeElement);
    saved=had?saved.filter((value)=>value!==dish.id):[...saved,dish.id];
    const persisted=persist();
    if(state.view==='saved')render();
    $('#saved-count').textContent=saved.length?'('+saved.length+')':'';
    $$('[data-save="'+dish.id+'"]').forEach((button)=>{
      const selected=saved.includes(dish.id);button.setAttribute('aria-pressed',String(selected));
      if(button.classList.contains('bookmark')){button.classList.toggle('saved',selected);button.setAttribute('aria-label',(selected?'取消收藏':'收藏')+dish.name);}
      else button.textContent=selected?'已收藏 · 取消':'收藏';
    });
    if(restore) {
      const next=inside?dialog.querySelector('[data-save="'+dish.id+'"]'):$('#dish-grid [data-save="'+dish.id+'"]')||$('#dish-grid .empty-state button')||$('.saved-nav');
      next?.focus({preventScroll:true});
    }
    if(persisted)toast(had?'已取消收藏':'已收藏');
  }
  function reviewHTML(review,local=false) {
    const name=local?'我':review.author;
    const time=local?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(review.createdAt)):'示例';
    return '<article class="review-item"><div class="review-meta"><span class="review-person"><strong>'+escape(name)+'</strong><small>'+escape(time)+(local?' · 仅本机':'')+'</small></span><span class="review-stars" aria-label="'+review.rating+'星">'+'★'.repeat(review.rating)+'☆'.repeat(5-review.rating)+'</span></div><p>'+escape(review.text)+'</p>'+(local?'<button class="review-delete" data-delete-review="'+escape(review.id)+'">删除</button>':'')+'</article>';
  }
  function openDetail(id,keepPosition=false) {
    const d=findDish(id);if(!d)return;
    detailId=d.id;
    const previousScroll=dialog.scrollTop;
    const local=ownReviews(d.id);
    openModal('<div class="detail-photo"><img src="./assets/'+d.image+'.jpg" alt="'+escape(d.name)+'的食物示意图"></div><div class="dialog-pad"><div class="detail-heading"><h2>'+escape(d.name)+'</h2><span class="dish-price"><small>¥</small>'+d.price+'</span></div><p class="detail-location">'+escape(d.hall)+' · '+escape(d.floor)+' · '+escape(d.stall)+'</p><div class="detail-facts"><span class="rating">★ '+rating(d)+'</span><span>'+['不辣','微辣','中辣'][d.spicy]+'</span><span>约'+d.wait+'分钟</span></div><p class="detail-note">'+escape(d.note)+'</p><p class="caution-box"><strong>注意</strong>'+escape(d.caution)+'</p><div class="detail-actions"><button class="button primary" data-action="review" data-review-dish="'+d.id+'">写点评</button><button class="button secondary" data-save="'+d.id+'" aria-pressed="'+saved.includes(d.id)+'">'+(saved.includes(d.id)?'已收藏 · 取消':'收藏')+'</button></div><div class="review-heading"><h3>同学评价</h3><span>'+d.reviewCount+'条示例'+(local.length?' · '+local.length+'条本机记录':'')+'</span></div>'+local.map((r)=>reviewHTML(r,true)).join('')+d.reviews.map((r)=>reviewHTML(r)).join('')+'<p class="fineprint">价格、评分与等待时间为示例。你的点评仅保存在本机。</p></div>',d.name+'详情','detail');
    if(keepPosition)dialog.scrollTop=previousScroll;
  }
  function openReview(id) {
    const d=findDish(id);if(!d)return;
    openModal('<div class="dialog-pad"><h2 class="dialog-title">评价'+escape(d.name)+'</h2><form id="review-form"><input type="hidden" name="dishId" value="'+d.id+'"><fieldset style="border:0;padding:0;margin:0"><legend class="field-label">评分</legend><div class="score-picker">'+['很差','一般','还行','不错','推荐'].map((label,i)=>'<label><input type="radio" name="rating" value="'+(i+1)+'" required><span>'+(i+1)+'<small>'+label+'</small></span></label>').join('')+'</div></fieldset><label class="field-label" for="review-text">吃得怎么样？</label><textarea id="review-text" class="review-textarea" name="text" minlength="5" maxlength="300" placeholder="说说口味、分量或排队时间" required></textarea><div class="counter-row"><span id="review-error" role="alert">至少5个字</span><span id="review-counter">0 / 300</span></div><p class="fineprint">仅保存在当前浏览器，其他人不可见。</p><button class="button primary form-submit" type="submit">保存点评</button></form></div>','评价'+d.name,'review');
  }
  function submitReview(form) {
    const values=new FormData(form),text=String(values.get('text')||'').trim(),d=findDish(values.get('dishId')),score=Number(values.get('rating'));
    if(!d||!Number.isInteger(score)||score<1||score>5||text.length<5||text.length>300) {
      $('#review-error').textContent='请选择评分，写下5—300个字。';$('#review-error').classList.add('form-error');return;
    }
    if(reviews.length>=200){toast('已保存200条点评，请先删除一些记录。');return;}
    const createdAt=Date.now();
    reviews.unshift({id:createdAt+'-'+Math.random().toString(36).slice(2,9),dishId:d.id,rating:score,text,createdAt});
    const persisted=persist();render();openDetail(d.id);if(persisted)toast('点评已保存在本机');
  }
  function chooseRandom(fresh=false) {
    if(fresh)randomLast=null;
    const candidates=filterDishes().filter((d)=>Number(rating(d))>=4);
    if(!candidates.length) {
      openModal('<div class="dialog-pad"><h2 class="dialog-title">暂时没有合适的推荐</h2><p class="random-empty">当前条件下没有4分以上的菜，放宽筛选再试试。</p><button class="button primary form-submit" data-action="change-filters">修改筛选</button></div>','帮我选','random');return;
    }
    const pool=candidates.length>1?candidates.filter((d)=>d.id!==randomLast):candidates;
    const d=pool[Math.floor(Math.random()*pool.length)];randomLast=d.id;
    const hint=[state.hall==='all'?'全部食堂':state.hall,state.price==='all'?'不限预算':state.price+'元以内'];
    openModal('<div class="dialog-pad"><h2 class="dialog-title">试试这道</h2><img class="random-photo" src="./assets/'+d.image+'.jpg" alt="'+escape(d.name)+'的食物示意图"><div class="random-title"><h3>'+escape(d.name)+'</h3><span class="dish-price"><small>¥</small>'+d.price+'</span></div><p class="random-location">'+escape(d.hall)+' · '+escape(d.floor)+' · '+escape(d.stall.split('·')[0])+'</p><p class="detail-note">'+escape(d.note)+'</p><div class="random-actions"><button class="button secondary" data-action="'+(candidates.length===1?'change-filters':'reroll')+'">'+(candidates.length===1?'修改筛选':'换一道')+'</button><button class="button primary" data-dish="'+d.id+'">查看详情</button></div><p class="fineprint">'+escape(hint.join(' · '))+' · 4分以上'+(candidates.length===1?'，仅这道符合条件':'')+'</p></div>','帮我选：'+d.name,'random');
  }
  function openAbout() {
    openModal('<div class="dialog-pad"><h2 class="dialog-title">关于这个演示</h2><div class="about-copy"><p><strong>示例数据</strong><br>学校、食堂、菜品、价格与点评为演示内容，图片来自 Unsplash 和 Wikimedia Commons，仅作食物示意。<a href="./assets/photo-sources.txt" target="_blank" rel="noopener noreferrer">图片来源与授权</a>。</p><p><strong>本机记录</strong><br>收藏和你的点评保存在当前浏览器。换设备或清除浏览器数据后，不会保留。</p></div><button class="button primary form-submit" data-action="close">知道了</button></div>','演示说明','about');
  }
  document.addEventListener('click',(event)=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.save){toggleSaved(button.dataset.save);return;}
    if(button.dataset.dish){openDetail(button.dataset.dish);return;}
    if(button.dataset.view){navigate(button.dataset.view);return;}
    if(button.dataset.deleteReview){
      const item=button.closest('.review-item');button.hidden=true;
      item.insertAdjacentHTML('beforeend','<div class="delete-confirm" role="group" aria-label="删除点评确认"><span>删除这条点评？</span><button class="button secondary" data-cancel-delete>取消</button><button class="button primary" data-confirm-delete="'+escape(button.dataset.deleteReview)+'">删除</button></div>');
      item.querySelector('[data-cancel-delete]').focus();return;
    }
    if(button.hasAttribute('data-cancel-delete')){const item=button.closest('.review-item');item.querySelector('.delete-confirm').remove();item.querySelector('[data-delete-review]').hidden=false;item.querySelector('[data-delete-review]').focus();return;}
    if(button.dataset.confirmDelete){reviews=reviews.filter((r)=>r.id!==button.dataset.confirmDelete);const persisted=persist();render();openDetail(detailId,true);if(persisted)toast('已删除点评');return;}
    if(button.id==='filter-toggle'){setFiltersOpen($('#extra-filters').hidden);return;}
    switch(button.dataset.action) {
      case 'close':closeModal();break;
      case 'random':chooseRandom(true);break;
      case 'reroll':chooseRandom();break;
      case 'review':openReview(button.dataset.reviewDish);break;
      case 'about':openAbout();break;
      case 'more':state.limit+=6;render();$('#dish-grid .dish-card:nth-child('+(state.limit-5)+') .dish-main')?.focus({preventScroll:true});break;
      case 'clear':resetFilters();render(true);break;
      case 'discover':navigate(state.view==='saved'?lastView:'discover');break;
      case 'change-filters':closeModal();setFiltersOpen(true);$('#hall-filter').focus();break;
    }
  });
  document.addEventListener('submit',(event)=>{if(event.target.id==='review-form'){event.preventDefault();submitReview(event.target);}});
  ['hall','price','category','spicy','sort'].forEach((name)=>$('#'+name+'-filter').addEventListener('change',(event)=>{state[name]=event.target.value;state.limit=6;render(true);}));
  $('#fast-filter').addEventListener('change',(event)=>{state.fast=event.target.checked;state.limit=6;render(true);});
  $('#search-input').addEventListener('input',(event)=>{state.query=event.target.value;state.limit=6;render();});
  document.addEventListener('input',(event)=>{if(event.target.id==='review-text'){$('#review-counter').textContent=event.target.value.length+' / 300';$('#review-error').classList.remove('form-error');}});
  dialog.addEventListener('close',restoreModalFocus);
  dialog.addEventListener('click',(event)=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
  document.addEventListener('error',(event)=>{if(event.target instanceof HTMLImageElement&&!event.target.dataset.fallback){event.target.dataset.fallback='true';event.target.src='./assets/rice.jpg';}},true);
  window.addEventListener('popstate',()=>{if(dialog.open)closeModal();restoreURL();render();});
  restoreURL();render();
})();
