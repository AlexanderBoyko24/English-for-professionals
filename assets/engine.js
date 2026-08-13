/* ================================================================
   ДВИЖОК УРОКА
   ----------------------------------------------------------------
   Один файл на все темы. Данные темы лежат в window.LESSON,
   адрес темы — в window.TOPIC (курс, подкурс, номер).

   Что делает:
   • рисует упражнения из данных урока;
   • ведёт прогресс по каждому упражнению отдельно и общий по теме;
   • сохраняет ответы и восстанавливает их при следующем заходе.

   Правила подсчёта процентов описаны в EX_RULES ниже.
   ================================================================ */

(function () {
  'use strict';

  var L = window.LESSON;
  var TOPIC = window.TOPIC || { course: 'medical', subcourse: 'anatomy', topic: '1' };
  var TOPIC_KEY = TOPIC.course + '/' + TOPIC.subcourse + '/' + TOPIC.topic;
  var STATE_VERSION = 1;

  /* ---------------- мелкие помощники ---------------- */

  var mk = function (t, c, h) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (h != null) e.innerHTML = h;
    return e;
  };
  var $ = function (id) { return document.getElementById(id); };
  var spk = function (t) {
    if (!('speechSynthesis' in window)) return;
    var u = new SpeechSynthesisUtterance(t);
    u.lang = 'en-US';
    u.rate = 0.92;
    speechSynthesis.speak(u);
  };
  var shuf = function (a) { return a.slice().sort(function () { return Math.random() - 0.5; }); };
  var norm = function (s) { return String(s == null ? '' : s).trim().toLowerCase(); };

  /* Сравнение собранного предложения с эталоном.
     Не учитываем:
     • знаки препинания — в эталонах есть запятые, двоеточия и точки
       с запятой, которых нет на карточках, иначе такие предложения
       нельзя было бы собрать в принципе;
     • подсказки в скобках — на части карточек стоит перевод. */
  var normSentence = function (s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[.,;:!?"']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /* ================================================================
     ПРОГРЕСС
     ================================================================ */

  /* Как считается процент у каждого типа упражнения:
       items — доля верно выполненных пунктов;
       mark  — 0 или 100 по кнопке «Mark as learned»;
       score — процент приходит целиком (чтение вслух, финальный тест). */
  var EX_RULES = {
    voc: 'mark', txt: 'mark', vid: 'mark',
    tp: 'items', te: 'items', tf: 'items',
    m: 'items', mp: 'items', mm: 'items', ls: 'items', ld: 'items',
    ft: 'items', fb: 'items', j: 'items', lg: 'items',
    rp: 'score', test: 'score'
  };

  var P = {
    exercises: {},     // id -> { id, title, total, kind, items, marked, score }
    order: [],
    loaded: null,      // состояние из хранилища
    saveTimer: null,
    saving: false,

    /* Загружает сохранённое состояние до отрисовки. */
    load: async function () {
      try {
        var row = await window.API.progress.getTopic(TOPIC_KEY);
        this.loaded = row && row.state && row.state.exercises ? row.state : null;
      } catch (e) {
        console.error('Не удалось загрузить прогресс:', e);
        this.loaded = null;
      }
    },

    register: function (id, title, total, kind) {
      var saved = this.loaded && this.loaded.exercises ? this.loaded.exercises[id] : null;
      var ex = {
        id: id,
        title: title,
        total: Math.max(1, total || 1),
        kind: kind || EX_RULES[id] || 'items',
        items: {},
        marked: false,
        score: 0
      };
      if (saved) {
        ex.marked = !!saved.marked;
        ex.score = typeof saved.score === 'number' ? saved.score : 0;
        if (saved.items && typeof saved.items === 'object') {
          Object.keys(saved.items).forEach(function (k) {
            var it = saved.items[k];
            if (!it || typeof it !== 'object') return;
            /* null сохраняем как null: это «ответ дан, но не проверен». */
            ex.items[k] = { c: it.c === true ? true : (it.c === false ? false : null), v: it.v };
          });
        }
      }
      this.exercises[id] = ex;
      if (this.order.indexOf(id) === -1) this.order.push(id);
      return ex;
    },

    /* Сохранённые пункты упражнения — для восстановления интерфейса. */
    savedItems: function (id) {
      var ex = this.exercises[id];
      return ex ? ex.items : {};
    },

    /* Копия пунктов. Нужна там, где восстановление интерфейса само
       пишет в состояние (перетаскивания) и затирает исходные отметки. */
    snapshot: function (id) {
      var ex = this.exercises[id];
      if (!ex) return {};
      var copy = {};
      Object.keys(ex.items).forEach(function (k) {
        copy[k] = { c: ex.items[k].c, v: ex.items[k].v };
      });
      return copy;
    },

    savedItem: function (id, index) {
      var ex = this.exercises[id];
      if (!ex) return null;
      return ex.items[String(index)] || null;
    },

    isMarked: function (id) {
      var ex = this.exercises[id];
      return !!(ex && ex.marked);
    },

    savedScore: function (id) {
      var ex = this.exercises[id];
      return ex ? ex.score : 0;
    },

    /* Запомнить ответ без изменения процента.
       c === null означает «ответ дан, но ещё не проверен» — это важно
       отличать от «проверено и неверно», иначе после перезагрузки
       непроверенная расстановка подсветится красным. */
    setValue: function (id, index, value) {
      var ex = this.exercises[id];
      if (!ex) return;
      ex.items[String(index)] = { c: null, v: value };
      this.refresh(id);
    },

    clearValue: function (id, index) {
      var ex = this.exercises[id];
      if (!ex) return;
      delete ex.items[String(index)];
      this.refresh(id);
    },

    /* Пункт проверен: correct решает, засчитывается ли он в процент. */
    setItem: function (id, index, correct, value) {
      var ex = this.exercises[id];
      if (!ex) return;
      var prev = ex.items[String(index)] || {};
      ex.items[String(index)] = { c: !!correct, v: value === undefined ? prev.v : value };
      this.refresh(id);
    },

    /* true — проверено и верно, false — проверено и неверно, null — не проверено. */
    checkedState: function (saved) {
      if (!saved || saved.c === null || saved.c === undefined) return null;
      return !!saved.c;
    },

    mark: function (id) {
      var ex = this.exercises[id];
      if (!ex) return;
      ex.marked = true;
      this.refresh(id);
    },

    setScore: function (id, percent) {
      var ex = this.exercises[id];
      if (!ex) return;
      var p = Math.max(0, Math.min(100, Math.round(percent)));
      /* Оставляем лучший результат: повторная неудачная попытка
         не должна отбирать уже заработанный процент. */
      if (p > ex.score) ex.score = p;
      this.refresh(id);
    },

    percentOf: function (id) {
      var ex = this.exercises[id];
      if (!ex) return 0;
      if (ex.kind === 'mark') return ex.marked ? 100 : 0;
      if (ex.kind === 'score') return ex.score;
      var correct = 0;
      var self = this;
      Object.keys(ex.items).forEach(function (k) { if (ex.items[k].c) correct++; });
      return Math.round((Math.min(correct, ex.total) / ex.total) * 100);
    },

    countOf: function (id) {
      var ex = this.exercises[id];
      if (!ex) return { done: 0, total: 1 };
      if (ex.kind === 'mark') return { done: ex.marked ? 1 : 0, total: 1 };
      if (ex.kind === 'score') return { done: ex.score ? 1 : 0, total: 1 };
      var correct = 0;
      Object.keys(ex.items).forEach(function (k) { if (ex.items[k].c) correct++; });
      return { done: Math.min(correct, ex.total), total: ex.total };
    },

    totalPercent: function () {
      var self = this;
      if (!this.order.length) return 0;
      var sum = this.order.reduce(function (acc, id) { return acc + self.percentOf(id); }, 0);
      return Math.round(sum / this.order.length);
    },

    /* Перерисовать шкалу упражнения и общую шкалу, поставить сохранение в очередь. */
    refresh: function (id) {
      if (id) this.paint(id);
      this.paintTotal();
      this.queueSave();
    },

    paint: function (id) {
      var pct = this.percentOf(id);
      var cnt = this.countOf(id);
      var ex = this.exercises[id];
      var bar = document.querySelector('.ex-progress[data-for="' + id + '"]');
      if (bar) {
        bar.classList.toggle('done', pct >= 100);
        bar.classList.toggle('partial', pct > 0 && pct < 100);
        var fill = bar.querySelector('.ex-fill');
        if (fill) fill.style.width = pct + '%';
        var num = bar.querySelector('.ex-num');
        if (num) {
          num.textContent = ex && ex.kind === 'items'
            ? cnt.done + ' / ' + cnt.total + ' · ' + pct + '%'
            : pct + '%';
        }
      }
      var badge = document.querySelector('.ex-badge[data-for="' + id + '"]');
      if (badge) {
        badge.classList.toggle('done', pct >= 100);
        badge.classList.toggle('partial', pct > 0 && pct < 100);
        badge.textContent = pct >= 100 ? '✓ Готово' : pct > 0 ? 'В работе' : '';
      }
    },

    paintAll: function () {
      var self = this;
      this.order.forEach(function (id) { self.paint(id); });
      this.paintTotal();
    },

    paintTotal: function () {
      var pct = this.totalPercent();
      var fill = $('pFill');
      var lbl = $('pLbl');
      if (fill) fill.style.width = pct + '%';
      if (lbl) {
        var doneCount = this.order.filter(function (id) { return P.percentOf(id) >= 100; }).length;
        lbl.textContent = doneCount + ' / ' + this.order.length + ' · ' + pct + '%';
      }
    },

    serialize: function () {
      var out = { version: STATE_VERSION, exercises: {} };
      var self = this;
      this.order.forEach(function (id) {
        var ex = self.exercises[id];
        if (!ex) return;
        out.exercises[id] = {
          kind: ex.kind,
          total: ex.total,
          marked: ex.marked,
          score: ex.score,
          items: ex.items,
          percent: self.percentOf(id)
        };
      });
      return out;
    },

    queueSave: function () {
      var self = this;
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(function () { self.flush(); }, 700);
    },

    flush: async function () {
      if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
      if (this.saving) return;
      this.saving = true;
      showSaveState('Сохраняем…');
      try {
        await window.API.progress.saveTopic(TOPIC_KEY, {
          percent: this.totalPercent(),
          state: this.serialize()
        });
        showSaveState('Прогресс сохранён');
      } catch (e) {
        console.error('Не удалось сохранить прогресс:', e);
        showSaveState('Не удалось сохранить', true);
      } finally {
        this.saving = false;
      }
    },

    reset: async function () {
      await window.API.progress.resetTopic(TOPIC_KEY);
    }
  };

  var saveStateEl = null;
  var saveStateTimer = null;

  function showSaveState(text, isError) {
    if (!saveStateEl) {
      saveStateEl = mk('div', 'save-state');
      document.body.appendChild(saveStateEl);
    }
    saveStateEl.textContent = text;
    saveStateEl.classList.toggle('err', !!isError);
    saveStateEl.classList.add('show');
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(function () { saveStateEl.classList.remove('show'); }, 1800);
  }

  /* Успеть сохранить, если страницу закрывают. */
  window.addEventListener('beforeunload', function () {
    if (P.saveTimer) P.flush();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && P.saveTimer) P.flush();
  });

  /* ================================================================
     КАРКАС УПРАЖНЕНИЯ
     ================================================================ */

  function block(num, title, sub, exId) {
    var b = mk('div', 'block');
    if (exId) b.dataset.exerciseId = exId;
    var h = mk('div', 'bh');
    h.appendChild(Object.assign(mk('div', 'bnum'), { textContent: num }));
    h.appendChild(mk('div', 'btitle', title + (sub ? '<small>· ' + sub + '</small>' : '')));
    if (exId) {
      var badge = mk('span', 'ex-badge');
      badge.dataset.for = exId;
      h.appendChild(badge);
    }
    b.appendChild(h);
    if (exId) {
      var bar = mk('div', 'ex-progress');
      bar.dataset.for = exId;
      bar.innerHTML = '<div class="ex-track"><div class="ex-fill"></div></div><div class="ex-num">0%</div>';
      b.appendChild(bar);
    }
    var bb = mk('div', 'bb');
    b.appendChild(bb);
    return { b: b, bb: bb };
  }

  /* Кнопка «Mark as learned» для словаря, текста и видео. */
  function markButton(exId, hint) {
    var wrap = mk('div', 'mark-wrap');
    var btn = mk('button', 'mark-btn', '<i class="far fa-circle"></i> Mark as learned');
    function applyDone() {
      btn.className = 'mark-btn done';
      btn.innerHTML = '<i class="fas fa-circle-check"></i> Learned';
      btn.disabled = true;
    }
    btn.onclick = function () {
      P.mark(exId);
      applyDone();
    };
    if (P.isMarked(exId)) applyDone();
    wrap.appendChild(btn);
    if (hint) wrap.appendChild(mk('span', 'mark-hint', hint));
    return wrap;
  }

  /* ================================================================
     УПРАЖНЕНИЯ
     ================================================================ */

  /* --- 1. Словарь --- */
  function vocab(data, n, id) {
    P.register(id, 'Vocabulary', 1, 'mark');
    var r = block(n, 'Vocabulary', 'new words and terms', id);
    var g = mk('div', 'vgrid');
    data.forEach(function (item) {
      var i = mk('div', 'vi');
      i.innerHTML =
        '<span class="vw">' + item.word + '</span>' +
        '<span class="vt">' + (item.trans || '') + '</span>' +
        '<span class="vr">' + (item.ru || '') + '</span>';
      var s = mk('button', 'sbtn', '<i class="fas fa-volume-up"></i>');
      s.onclick = function (e) { e.stopPropagation(); spk(item.word); };
      i.appendChild(s);
      g.appendChild(i);
    });
    r.bb.appendChild(g);
    r.bb.appendChild(markButton(id, 'Отметьте, когда выучите слова — упражнение зачтётся полностью.'));
    return r.b;
  }

  /* --- 2. Текст для чтения --- */
  function textBlock(data, n, id) {
    P.register(id, 'Read & Translate', 1, 'mark');
    var r = block(n, 'Read & Translate', 'read and translate', id);
    var w = mk('div', 'tblock');

    var vocabMap = {};
    if (L.vocabulary) {
      L.vocabulary.forEach(function (item) {
        var base = norm(item.word);
        var entry = { trans: item.trans || '', ru: item.ru || '', original: item.word };
        vocabMap[base] = entry;
        vocabMap[base + 's'] = entry;
        vocabMap[base + 'es'] = entry;
        vocabMap[base + 'ed'] = entry;
        vocabMap[base + 'ing'] = entry;
      });
    }

    function highlight(raw) {
      var terms = Object.keys(vocabMap);
      if (!terms.length) return raw;
      terms.sort(function (a, b) { return b.length - a.length; });
      var escaped = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'); });
      var re = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'gi');
      return raw.replace(re, function (match) {
        var v = vocabMap[match.toLowerCase()];
        if (!v || !v.ru) return match;
        return '<span class="vhl" data-word="' + v.original + '" data-trans="' + v.trans + '" data-ru="' + v.ru + '">' + match + '</span>';
      });
    }

    data.forEach(function (p) {
      var el = mk('p');
      el.innerHTML = highlight(p);
      w.appendChild(el);
    });
    r.bb.appendChild(w);

    var tip = mk('div', 'vtip');
    tip.style.display = 'none';
    document.body.appendChild(tip);
    w.addEventListener('mouseover', function (e) {
      var t = e.target.closest('.vhl');
      if (!t) return;
      tip.innerHTML = '<b>' + t.dataset.word + '</b><br><span class="vtt">' + t.dataset.trans + '</span><br>' + t.dataset.ru;
      var rect = t.getBoundingClientRect();
      tip.style.left = Math.min(rect.left, window.innerWidth - 270) + 'px';
      tip.style.top = (rect.bottom + window.scrollY + 10) + 'px';
      tip.style.display = 'block';
    });
    w.addEventListener('mouseout', function () { tip.style.display = 'none'; });

    r.bb.appendChild(markButton(id, 'Отметьте, когда прочитаете и переведёте текст.'));
    return r.b;
  }

  /* --- 3. True / False --- */
  function trueFalse(data, n, id) {
    P.register(id, 'True / False', data.length, 'items');
    var r = block(n, 'True / False', 'true or false', id);
    var scroll = mk('div', 'scroll-area');

    data.forEach(function (item, index) {
      var row = mk('div', 'tfi');
      row.appendChild(mk('div', 'tfs', item.s));
      var btns = mk('div', 'tfb');
      var saved = P.savedItem(id, index);

      ['True', 'False'].forEach(function (label) {
        var isOk = (label === 'True') === item.correct;
        var btn = mk('button', 'tfbtn', label);
        btn.dataset.value = label;
        btn.onclick = function () {
          btns.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
          btn.classList.add(isOk ? 'correct' : 'wrong');
          P.setItem(id, index, isOk, label);
        };
        btns.appendChild(btn);
      });

      /* Восстановление ранее сделанного выбора. */
      if (saved && saved.v) {
        btns.querySelectorAll('button').forEach(function (x) {
          x.disabled = true;
          if (x.dataset.value === saved.v) x.classList.add(saved.c ? 'correct' : 'wrong');
        });
      }

      row.appendChild(btns);
      scroll.appendChild(row);
    });

    r.bb.appendChild(scroll);
    return r.b;
  }

  /* --- 4. Перевод словосочетаний (в обе стороны) --- */
  function translateRows(data, n, id, opts) {
    P.register(id, opts.title, data.length, 'items');
    var r = block(n, opts.title, opts.sub, id);
    var scroll = mk('div', 'scroll-area');

    data.forEach(function (item, index) {
      var row = mk('div', 'tp-row');
      var left = mk('div', 'tp-en');
      left.textContent = item[opts.from];
      var right = mk('div', 'tp-right');
      var inp = mk('input', 'tp-inp');
      inp.type = 'text';
      inp.placeholder = opts.placeholder;
      var answer = norm(item[opts.to]);
      var res = mk('span', 'tp-res');

      function evaluate(fromRestore) {
        var value = inp.value.trim();
        if (value === '') {
          inp.classList.remove('tp-ok', 'tp-err');
          res.textContent = '';
          if (!fromRestore) P.clearValue(id, index);
          return;
        }
        var ok = norm(value) === answer;
        inp.classList.toggle('tp-ok', ok);
        inp.classList.toggle('tp-err', !ok);
        res.textContent = ok ? '✓ Correct' : '✗ Wrong';
        res.style.color = ok ? 'var(--green)' : 'var(--red)';
        if (!fromRestore) P.setItem(id, index, ok, value);
      }

      inp.addEventListener('input', function () { evaluate(false); });

      var saved = P.savedItem(id, index);
      if (saved && saved.v != null && saved.v !== '') {
        inp.value = saved.v;
        evaluate(true);
      }

      right.appendChild(inp);
      right.appendChild(res);
      row.appendChild(left);
      row.appendChild(right);
      scroll.appendChild(row);
    });

    r.bb.appendChild(scroll);
    return r.b;
  }

  /* --- 5. Сопоставление терминов и определений --- */
  function matching(data, n, id) {
    P.register(id, 'Match Terms & Definitions', data.length, 'items');
    var r = block(n, 'Match Terms & Definitions', 'drag term to definition', id);

    var layout = mk('div', 'mlayout');
    var termsDiv = mk('div', 'terms-col');
    termsDiv.appendChild(mk('div', 'colh', ' TERMS (drag from here)'));
    var termsList = mk('div', '');
    termsDiv.appendChild(termsList);

    var defsDiv = mk('div', 'defs-col');
    defsDiv.appendChild(mk('div', 'colh', ' DEFINITIONS (drop here)'));
    var defsList = mk('div', '');
    defsDiv.appendChild(defsList);

    layout.appendChild(termsDiv);
    layout.appendChild(defsDiv);
    r.bb.appendChild(layout);

    var msg = mk('div', '');
    msg.style.cssText = 'margin-top:16px;text-align:center;font-size:.9rem';

    function makeTerm(text) {
      var el = mk('div', 'dterm', text);
      el.dataset.term = text;
      el.draggable = true;
      el.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', text);
        el.style.opacity = '.4';
      });
      el.addEventListener('dragend', function () { el.style.opacity = ''; });
      return el;
    }

    function place(zone, term) {
      var slotIndex = Number(zone.dataset.index);
      zone.classList.remove('correct', 'wrong');
      var existing = zone.querySelector('.placed');
      if (existing) {
        termsList.appendChild(makeTerm(existing.dataset.term));
        existing.remove();
      }
      var source = Array.prototype.slice.call(termsList.querySelectorAll('.dterm')).filter(function (el) {
        return el.dataset.term === term;
      })[0];
      if (source) source.remove();

      var span = mk('span', 'placed', term);
      span.dataset.term = term;
      span.style.cursor = 'pointer';
      span.title = 'Двойной клик — вернуть слово обратно';
      span.addEventListener('dblclick', function () {
        termsList.appendChild(makeTerm(term));
        span.remove();
        P.clearValue(id, slotIndex);
      });
      zone.appendChild(span);
      P.setValue(id, slotIndex, term);
    }

    function buildZones() {
      defsList.innerHTML = '';
      data.forEach(function (item, index) {
        var zone = mk('div', 'ddrop', '');
        zone.dataset.correct = item.term;
        zone.dataset.index = String(index);
        var text = mk('div', '', ' ' + item.def);
        text.style.cssText = 'font-size:.9rem;margin-bottom:6px';
        zone.appendChild(text);
        zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('over'); });
        zone.addEventListener('dragleave', function () { zone.classList.remove('over'); });
        zone.addEventListener('drop', function (e) {
          e.preventDefault();
          zone.classList.remove('over');
          var term = e.dataTransfer.getData('text/plain');
          if (term) place(zone, term);
        });
        defsList.appendChild(zone);
      });
    }

    function fillTerms(list) {
      termsList.innerHTML = '';
      list.forEach(function (t) { termsList.appendChild(makeTerm(t)); });
    }

    buildZones();
    fillTerms(shuf(data.map(function (i) { return i.term; })));

    /* Восстановление расстановки. */
    /* Снимок делаем до расстановки: place() перезаписывает пункты
       как «не проверено», иначе отметки о проверке потеряются. */
    var saved = P.snapshot(id);
    var anyRestored = false;
    Object.keys(saved).forEach(function (k) {
      var zone = defsList.querySelector('.ddrop[data-index="' + k + '"]');
      if (!zone || !saved[k].v) return;
      place(zone, saved[k].v);
      var state = P.checkedState(saved[k]);
      if (state !== null) {
        var placed = zone.querySelector('.placed');
        if (placed) placed.classList.add(state ? 'correct' : 'wrong');
        P.setItem(id, Number(k), state, saved[k].v);
      }
      anyRestored = true;
    });
    if (anyRestored) msg.innerHTML = '<span style="color:var(--muted)">Расстановка восстановлена из прошлого захода.</span>';

    var controls = mk('div', 'matching-controls');
    var resetBtn = mk('button', 'cbtn', '↺ Reset');
    resetBtn.onclick = function () {
      buildZones();
      fillTerms(shuf(data.map(function (i) { return i.term; })));
      data.forEach(function (_, index) { P.clearValue(id, index); });
      msg.innerHTML = '';
    };
    var checkBtn = mk('button', 'cbtn check-btn', '✓ Check');
    checkBtn.onclick = function () {
      var correct = 0;
      data.forEach(function (item, index) {
        var zone = defsList.querySelector('.ddrop[data-index="' + index + '"]');
        var placed = zone ? zone.querySelector('.placed') : null;
        if (!placed) {
          P.setItem(id, index, false, null);
          return;
        }
        var ok = placed.dataset.term === zone.dataset.correct;
        placed.classList.toggle('correct', ok);
        placed.classList.toggle('wrong', !ok);
        if (ok) correct++;
        P.setItem(id, index, ok, placed.dataset.term);
      });
      var pct = Math.round((correct / data.length) * 100);
      msg.innerHTML = correct === data.length
        ? '<span style="color:var(--green)">✅ Все пары верны — 100%.</span>'
        : '<span style="color:var(--ac)">Верно ' + correct + ' из ' + data.length + ' — ' + pct + '%. Двойной клик по слову вернёт его обратно.</span>';
    };
    controls.appendChild(resetBtn);
    controls.appendChild(checkBtn);
    r.bb.appendChild(controls);
    r.bb.appendChild(msg);
    return r.b;
  }

  /* --- 6. Подбор картинки к определению --- */
  function matchPicture(data, n, id) {
    P.register(id, 'Match the Picture', data.length, 'items');
    var r = block(n, 'Match the Picture', 'drag picture to definition', id);
    var lessonNum = String(L.number).replace(/^0/, '');

    var grid = mk('div', 'mp-grid');
    var imagesCol = mk('div', 'mp-images');
    var defsCol = mk('div', 'mp-defs');

    data.forEach(function (item) {
      var card = mk('div', 'mp-image-card');
      card.draggable = true;
      card.dataset.image = item.image;
      var img = mk('img', '');
      img.src = 'images/' + lessonNum + '/' + item.image;
      img.alt = item.word;
      img.draggable = false;
      img.style.cursor = 'pointer';
      img.onclick = function (e) { e.stopPropagation(); openImage(img); };
      img.onerror = function () { card.style.display = 'none'; };
      card.appendChild(img);
      card.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', item.image);
        card.style.opacity = '.4';
      });
      card.addEventListener('dragend', function () { card.style.opacity = '1'; });
      imagesCol.appendChild(card);
    });

    function placeImage(zone, image) {
      var index = Number(zone.dataset.index);
      zone.classList.remove('correct', 'wrong');
      var existing = zone.querySelector('.mp-placed-img');
      if (existing) {
        var prev = imagesCol.querySelector('[data-image="' + existing.dataset.image + '"]');
        if (prev) prev.classList.remove('placed');
        existing.remove();
      }
      var source = imagesCol.querySelector('[data-image="' + image + '"]');
      if (source) source.classList.add('placed');
      var placed = mk('img', 'mp-placed-img');
      placed.src = 'images/' + lessonNum + '/' + image;
      placed.dataset.image = image;
      placed.addEventListener('click', function () {
        var card = imagesCol.querySelector('[data-image="' + image + '"]');
        if (card) card.classList.remove('placed');
        placed.remove();
        P.clearValue(id, index);
      });
      zone.appendChild(placed);
      P.setValue(id, index, image);
    }

    var shuffledDefs = shuf(data);
    shuffledDefs.forEach(function (item) {
      var index = data.indexOf(item);
      var zone = mk('div', 'mp-def-zone');
      zone.dataset.answer = item.image;
      zone.dataset.index = String(index);
      zone.appendChild(mk('div', 'mp-def-text', item.def));
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('over'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('over');
        var image = e.dataTransfer.getData('text/plain');
        if (image) placeImage(zone, image);
      });
      defsCol.appendChild(zone);
    });

    grid.appendChild(imagesCol);
    grid.appendChild(defsCol);
    r.bb.appendChild(grid);

    var saved = P.snapshot(id);
    Object.keys(saved).forEach(function (k) {
      var zone = defsCol.querySelector('.mp-def-zone[data-index="' + k + '"]');
      if (!zone || !saved[k].v) return;
      placeImage(zone, saved[k].v);
      var state = P.checkedState(saved[k]);
      if (state !== null) {
        zone.classList.add(state ? 'correct' : 'wrong');
        P.setItem(id, Number(k), state, saved[k].v);
      }
    });

    var bw = mk('div', '');
    bw.style.cssText = 'display:flex;gap:10px;margin-top:18px;flex-wrap:wrap';
    var resetBtn = mk('button', 'cbtn', '↺ Reset');
    resetBtn.onclick = function () {
      imagesCol.querySelectorAll('.mp-image-card').forEach(function (c) { c.classList.remove('placed'); });
      defsCol.querySelectorAll('.mp-placed-img').forEach(function (i) { i.remove(); });
      defsCol.querySelectorAll('.mp-def-zone').forEach(function (z) { z.classList.remove('correct', 'wrong'); });
      data.forEach(function (_, index) { P.clearValue(id, index); });
    };
    var checkBtn = mk('button', 'cbtn', '✓ Check');
    checkBtn.style.cssText += 'background:rgba(52,211,153,.12);border-color:var(--green);color:var(--green)';
    checkBtn.onclick = function () {
      defsCol.querySelectorAll('.mp-def-zone').forEach(function (zone) {
        var index = Number(zone.dataset.index);
        zone.classList.remove('correct', 'wrong');
        var placed = zone.querySelector('.mp-placed-img');
        var ok = !!placed && placed.dataset.image === zone.dataset.answer;
        zone.classList.add(ok ? 'correct' : 'wrong');
        P.setItem(id, index, ok, placed ? placed.dataset.image : null);
      });
    };
    bw.appendChild(resetBtn);
    bw.appendChild(checkBtn);
    r.bb.appendChild(bw);
    return r.b;
  }

  /* --- Общая механика «перетащи слово в слот» (mind map, sequence, diagram) --- */
  function slotExercise(cfg) {
    P.register(cfg.id, cfg.title, cfg.slots.length, 'items');
    var r = block(cfg.num, cfg.title, cfg.sub, cfg.id);
    var wrap = mk('div', cfg.wrapClass);
    if (cfg.buildWrap) cfg.buildWrap(wrap);

    var optsDiv = mk('div', cfg.optionsClass);
    var slotEls = [];

    function releaseOption(word) {
      var opt = optsDiv.querySelector('.' + cfg.optionClass + '[data-word="' + cssEscape(word) + '"]');
      if (opt) opt.classList.remove('placed');
    }

    function takeOption(word) {
      var opt = optsDiv.querySelector('.' + cfg.optionClass + '[data-word="' + cssEscape(word) + '"]');
      if (opt) opt.classList.add('placed');
    }

    function placeWord(slot, word) {
      var index = Number(slot.dataset.index);
      /* Ответ изменился — прошлый вердикт больше не действует. */
      slot.classList.remove('correct', 'wrong');
      var existing = slot.querySelector('.' + cfg.placedClass);
      if (existing) {
        releaseOption(existing.dataset.word);
        existing.remove();
      }
      var placed = mk('span', cfg.placedClass, word);
      placed.dataset.word = word;
      if (cfg.placedStyle) placed.style.cssText = cfg.placedStyle;
      placed.title = 'Двойной клик — убрать';
      placed.addEventListener('dblclick', function () {
        releaseOption(word);
        placed.remove();
        if (cfg.onClearSlot) cfg.onClearSlot(slot);
        P.clearValue(cfg.id, index);
      });
      slot.appendChild(placed);
      if (cfg.onFillSlot) cfg.onFillSlot(slot);
      takeOption(word);
      P.setValue(cfg.id, index, word);
    }

    cfg.slots.forEach(function (spec, index) {
      var slot = cfg.makeSlot(spec, index, wrap);
      slot.dataset.index = String(index);
      slot.dataset.answer = spec.answer;
      slot.addEventListener('dragover', function (e) { e.preventDefault(); slot.classList.add('over'); });
      slot.addEventListener('dragleave', function () { slot.classList.remove('over'); });
      slot.addEventListener('drop', function (e) {
        e.preventDefault();
        slot.classList.remove('over');
        var word = e.dataTransfer.getData('text/plain');
        if (word) placeWord(slot, word);
      });
      slotEls.push(slot);
    });

    if (cfg.afterSlots) cfg.afterSlots(wrap);

    shuf(cfg.options).forEach(function (word) {
      var opt = mk('div', cfg.optionClass, word);
      opt.draggable = true;
      opt.dataset.word = word;
      opt.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', word);
        opt.style.opacity = '.4';
      });
      opt.addEventListener('dragend', function () { opt.style.opacity = '1'; });
      optsDiv.appendChild(opt);
    });

    if (cfg.optionsInWrap === false) {
      r.bb.appendChild(wrap);
      r.bb.appendChild(optsDiv);
    } else {
      wrap.appendChild(optsDiv);
      r.bb.appendChild(wrap);
    }

    var saved = P.snapshot(cfg.id);
    Object.keys(saved).forEach(function (k) {
      var slot = slotEls[Number(k)];
      if (!slot || !saved[k].v) return;
      placeWord(slot, saved[k].v);
      var state = P.checkedState(saved[k]);
      if (state !== null) {
        slot.classList.add(state ? 'correct' : 'wrong');
        P.setItem(cfg.id, Number(k), state, saved[k].v);
      }
    });

    var bw = mk('div', '');
    bw.style.cssText = 'display:flex;gap:10px;margin-top:18px;flex-wrap:wrap';
    var resetBtn = mk('button', 'cbtn', '↺ Reset');
    resetBtn.onclick = function () {
      slotEls.forEach(function (slot, index) {
        var placed = slot.querySelector('.' + cfg.placedClass);
        if (placed) {
          releaseOption(placed.dataset.word);
          placed.remove();
          if (cfg.onClearSlot) cfg.onClearSlot(slot);
        }
        slot.classList.remove('correct', 'wrong');
        P.clearValue(cfg.id, index);
      });
    };
    var checkBtn = mk('button', 'cbtn', '✓ Check');
    checkBtn.style.cssText += 'background:rgba(52,211,153,.12);border-color:var(--green);color:var(--green)';
    checkBtn.onclick = function () {
      slotEls.forEach(function (slot, index) {
        slot.classList.remove('correct', 'wrong');
        var placed = slot.querySelector('.' + cfg.placedClass);
        var ok = !!placed && placed.dataset.word === slot.dataset.answer;
        slot.classList.add(ok ? 'correct' : 'wrong');
        P.setItem(cfg.id, index, ok, placed ? placed.dataset.word : null);
      });
    };
    bw.appendChild(resetBtn);
    bw.appendChild(checkBtn);
    r.bb.appendChild(bw);
    return r.b;
  }

  /* Экранирование значения для селектора [data-word="…"]. */
  function cssEscape(v) {
    return String(v).replace(/["\\]/g, '\\$&');
  }

  /* --- 7. Интеллект-карта --- */
  function mindMap(data, n, id) {
    var branchesHost = null;
    return slotExercise({
      id: id, num: n, title: 'Mind Map', sub: 'drag words to branches',
      wrapClass: 'mm-wrap', optionsClass: 'mm-options', optionClass: 'mm-option', placedClass: 'mm-placed',
      options: data.options,
      slots: data.branches,
      buildWrap: function (wrap) {
        wrap.appendChild(mk('div', 'mm-center', data.center));
        branchesHost = mk('div', 'mm-branches');
        wrap.appendChild(branchesHost);
      },
      makeSlot: function (spec) {
        var branch = mk('div', 'mm-branch');
        branch.appendChild(mk('div', 'mm-branch-label', spec.label));
        var slot = mk('div', 'mm-branch-slot', '');
        branch.appendChild(slot);
        branchesHost.appendChild(branch);
        return slot;
      }
    });
  }

  /* --- 8. Логическая последовательность --- */
  function logicalSequence(data, n, id) {
    var host = null;
    var slotSpecs = [];
    data.sequences.forEach(function (seq) {
      seq.steps.forEach(function (step) {
        if (!step.fixed) slotSpecs.push({ answer: step.answer, seq: seq, step: step });
      });
    });

    /* Слоты нужно создавать в порядке отрисовки цепочек. */
    var pending = slotSpecs.slice();
    return slotExercise({
      id: id, num: n, title: 'Logical Sequence', sub: 'complete sequences',
      wrapClass: 'ls-wrap', optionsClass: 'ls-options', optionClass: 'ls-option', placedClass: 'ls-placed',
      options: data.options,
      slots: slotSpecs,
      buildWrap: function (wrap) {
        host = wrap;
        /* Цепочки рисуем сразу, слоты подставим по ходу. */
        data.sequences.forEach(function (seq) {
          var chain = mk('div', 'ls-chain');
          chain.appendChild(mk('div', 'ls-chain-title', seq.title));
          var steps = mk('div', 'ls-steps');
          seq.steps.forEach(function (step, i) {
            if (i > 0) steps.appendChild(mk('span', 'ls-arrow', '→'));
            if (step.fixed) {
              steps.appendChild(mk('div', 'ls-step fixed', step.text));
            } else {
              var slot = mk('div', 'ls-slot', '');
              slot.dataset.pending = '1';
              steps.appendChild(slot);
            }
          });
          chain.appendChild(steps);
          wrap.appendChild(chain);
        });
      },
      makeSlot: function () {
        var slot = host.querySelector('.ls-slot[data-pending="1"]');
        if (slot) delete slot.dataset.pending;
        return slot || mk('div', 'ls-slot', '');
      }
    });
  }

  /* --- 9. Подписи к схеме --- */
  function labelDiagram(data, n, id) {
    var host = null;
    var lessonNum = String(L.number).replace(/^0/, '');
    return slotExercise({
      id: id, num: n, title: 'Label the Diagram', sub: 'drag the names to the correct places',
      wrapClass: 'ld-wrap', optionsClass: 'ld-options', optionClass: 'ld-option', placedClass: 'ld-placed',
      options: data.options,
      slots: data.markers,
      optionsInWrap: false,
      placedStyle: 'position:absolute;top:100%;left:50%;transform:translateX(-50%);background:var(--surface);padding:2px 6px;border-radius:4px;font-size:.7rem;white-space:nowrap;color:var(--text);margin-top:2px',
      buildWrap: function (wrap) {
        host = wrap;
        var img = mk('img', 'ld-image');
        img.src = 'images/' + lessonNum + '/' + data.image;
        img.alt = data.title || 'diagram';
        img.onerror = function () { img.style.display = 'none'; };
        wrap.appendChild(img);
      },
      makeSlot: function (spec) {
        var marker = mk('div', 'ld-marker', spec.label);
        marker.style.left = spec.x + '%';
        marker.style.top = spec.y + '%';
        marker.appendChild(mk('div', 'ld-marker-label', spec.label));
        host.appendChild(marker);
        return marker;
      },
      onFillSlot: function (slot) { slot.classList.add('filled'); },
      onClearSlot: function (slot) { slot.classList.remove('filled'); }
    });
  }

  /* --- 10. Заполнение таблицы --- */
  function fillTable(data, n, id) {
    P.register(id, data.title || 'Fill in the Table', data.rows.length, 'items');
    var r = block(n, data.title || 'Fill in the Table', data.caption || 'fill the table', id);
    var scroll = mk('div', 'scroll-area');
    var table = mk('table', 'ft-table');

    var thead = mk('thead', '');
    var hr = mk('tr', '');
    data.columns.forEach(function (col) {
      var th = mk('th', '');
      th.textContent = col.header;
      hr.appendChild(th);
    });
    var thBtn = mk('th', '');
    thBtn.style.cssText = 'width:90px';
    hr.appendChild(thBtn);
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = mk('tbody', '');

    data.rows.forEach(function (row, ri) {
      var tr = mk('tr', '');
      var inputs = [];

      data.columns.forEach(function (col) {
        var td = mk('td', '');
        var cellValue = row[col.key];
        if (cellValue && cellValue !== '') {
          var span = mk('span', 'ft-txt');
          span.textContent = cellValue;
          td.appendChild(span);
        } else {
          var inp = mk('input', 'ft-inp');
          inp.type = 'text';
          inp.placeholder = '...';
          var answer = data.answers && data.answers[ri] && data.answers[ri][col.key];
          if (answer) inp.dataset.answer = norm(answer);
          inputs.push({ key: col.key, input: inp, answer: inp.dataset.answer || '' });
          td.appendChild(inp);
        }
        tr.appendChild(td);
      });

      var tdBtn = mk('td', '');
      tdBtn.style.cssText = 'text-align:center';
      var check = mk('button', 'ft-check-btn', 'Check');
      var rowDone = false;

      function markRowCorrect() {
        rowDone = true;
        check.textContent = '✓';
        check.style.background = 'rgba(52,211,153,.12)';
        check.style.borderColor = 'var(--green)';
        check.style.color = 'var(--green)';
        check.style.cursor = 'default';
        inputs.forEach(function (item) {
          item.input.style.borderColor = 'var(--green)';
          item.input.style.background = 'rgba(52,211,153,.08)';
          item.input.style.color = 'var(--green)';
        });
      }

      check.addEventListener('click', function () {
        if (rowDone) return;
        var allCorrect = true;
        var hasEmpty = false;
        var values = {};
        inputs.forEach(function (item) {
          var value = item.input.value.trim();
          values[item.key] = value;
          if (value === '') {
            hasEmpty = true;
            allCorrect = false;
            item.input.style.borderColor = 'var(--red)';
            item.input.style.background = 'rgba(251,113,133,.08)';
          } else if (item.answer && norm(value) === item.answer) {
            item.input.style.borderColor = 'var(--green)';
            item.input.style.background = 'rgba(52,211,153,.08)';
            item.input.style.color = 'var(--green)';
          } else if (item.answer) {
            allCorrect = false;
            item.input.style.borderColor = 'var(--red)';
            item.input.style.background = 'rgba(251,113,133,.08)';
            item.input.style.color = 'var(--red)';
          }
        });

        P.setItem(id, ri, allCorrect && !hasEmpty, values);

        if (allCorrect && !hasEmpty) {
          markRowCorrect();
        } else {
          check.textContent = hasEmpty ? 'Fill all' : 'Retry';
          check.style.background = 'rgba(251,113,133,.12)';
          check.style.borderColor = 'var(--red)';
          check.style.color = 'var(--red)';
          setTimeout(function () {
            if (rowDone) return;
            check.textContent = 'Check';
            check.style.background = 'rgba(99,210,255,.08)';
            check.style.borderColor = 'rgba(99,210,255,.2)';
            check.style.color = 'var(--ac)';
          }, 1800);
        }
      });

      var saved = P.savedItem(id, ri);
      if (saved && saved.v && typeof saved.v === 'object') {
        inputs.forEach(function (item) {
          if (saved.v[item.key] != null) item.input.value = saved.v[item.key];
        });
        if (saved.c) markRowCorrect();
      }

      tdBtn.appendChild(check);
      tr.appendChild(tdBtn);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    scroll.appendChild(table);
    r.bb.appendChild(scroll);
    return r.b;
  }

  /* --- 11. Пропуски в предложениях --- */
  function fillBlanks(data, n, id) {
    P.register(id, 'Fill in the Gaps', data.length, 'items');
    var r = block(n, 'Fill in the Gaps', 'insert a word from the dictionary', id);
    var scroll = mk('div', 'scroll-area');

    data.forEach(function (item, i) {
      var row = mk('div', 'fi');
      var inp = mk('input', 'finp');
      inp.type = 'text';
      inp.placeholder = '…';
      var res = mk('span', 'fres');
      var btn = mk('button', 'cbtn', 'Check');

      function evaluate(fromRestore) {
        var value = inp.value.trim();
        var ok = norm(value) === norm(item.answer);
        res.className = 'fres ' + (ok ? 'ok' : 'err');
        res.textContent = ok ? '✓ Correct' : '✗ Wrong';
        inp.classList.toggle('inp-ok', ok);
        inp.classList.toggle('inp-err', !ok);
        if (!fromRestore) P.setItem(id, i, ok, value);
      }

      btn.onclick = function () { evaluate(false); };
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });

      var saved = P.savedItem(id, i);
      if (saved && saved.v != null && saved.v !== '') {
        inp.value = saved.v;
        evaluate(true);
      }

      row.appendChild(mk('span', '', (i + 1) + '. ' + (item.before ? item.before + ' ' : '')));
      row.appendChild(inp);
      if (item.after) row.appendChild(mk('span', '', ' ' + item.after));
      row.appendChild(btn);
      row.appendChild(res);
      scroll.appendChild(row);
    });

    r.bb.appendChild(scroll);
    return r.b;
  }

  /* --- 12. Порядок слов --- */
  function jumble(data, n, id) {
    P.register(id, 'Word Order', data.length, 'items');
    var r = block(n, 'Word Order', 'click words to make a sentence', id);
    var scroll = mk('div', 'scroll-area');

    data.forEach(function (item, i) {
      var wrap = mk('div', 'ji');
      wrap.appendChild(mk('div', 'jnum', 'SENTENCE ' + (i + 1)));
      var pool = mk('div', 'jwords');
      var zone = mk('div', 'dzone');
      var res = mk('span', 'jres');

      function toZone(word) {
        var slot = mk('div', 'dslot', word);
        slot.onclick = function () {
          slot.remove();
          toPool(word);
          saveOrder();
        };
        zone.appendChild(slot);
      }

      function toPool(word) {
        var chip = mk('div', 'jword', word);
        chip.onclick = function () {
          chip.remove();
          toZone(word);
          saveOrder();
        };
        pool.appendChild(chip);
      }

      function currentOrder() {
        return Array.prototype.slice.call(zone.querySelectorAll('.dslot')).map(function (x) {
          return x.textContent.trim();
        });
      }

      function saveOrder() {
        P.setValue(id, i, currentOrder());
      }

      function rebuild(words) {
        pool.innerHTML = '';
        zone.innerHTML = '';
        res.textContent = '';
        res.className = 'jres';
        words.forEach(toPool);
      }

      function evaluate(fromRestore) {
        var sentence = currentOrder().join(' ');
        var ok = normSentence(sentence) === normSentence(item.correct);
        res.className = 'jres ' + (ok ? 'ok' : 'err');
        res.textContent = ok ? '✓ Correct!' : '✗ Try again';
        if (!fromRestore) P.setItem(id, i, ok, currentOrder());
      }

      rebuild(shuf(item.words));

      var saved = P.savedItem(id, i);
      if (saved && Array.isArray(saved.v) && saved.v.length) {
        var remaining = item.words.slice();
        pool.innerHTML = '';
        zone.innerHTML = '';
        saved.v.forEach(function (word) {
          var idx = remaining.indexOf(word);
          if (idx !== -1) remaining.splice(idx, 1);
          toZone(word);
        });
        shuf(remaining).forEach(toPool);
        if (P.checkedState(saved) !== null) evaluate(true);
      }

      var resetBtn = mk('button', 'cbtn', '↺ Reset');
      resetBtn.style.marginRight = '6px';
      resetBtn.onclick = function () {
        rebuild(shuf(item.words));
        P.clearValue(id, i);
      };
      var checkBtn = mk('button', 'cbtn', 'Check');
      checkBtn.onclick = function () { evaluate(false); };

      var actions = mk('div', 'jact');
      actions.appendChild(resetBtn);
      actions.appendChild(checkBtn);
      actions.appendChild(res);
      wrap.appendChild(pool);
      wrap.appendChild(zone);
      wrap.appendChild(actions);
      scroll.appendChild(wrap);
    });

    r.bb.appendChild(scroll);
    return r.b;
  }

  /* --- 13. Аудирование с пропусками --- */
  function listeningGapFill(data, n, id) {
    var gaps = data.gaps || [];
    P.register(id, 'Listening: Gap Fill', gaps.length, 'items');
    var r = block(n, 'Listening: Gap Fill', 'listen and fill in the gaps', id);

    if (data.audio) {
      var audio = mk('audio');
      audio.controls = true;
      var source = mk('source');
      source.src = data.audio;
      source.type = 'audio/mpeg';
      audio.appendChild(source);
      r.bb.appendChild(audio);
    }

    var textWrap = mk('div', 'lg-text');
    var gapMap = {};
    gaps.forEach(function (g, index) { gapMap[g.id] = { gap: g, index: index }; });

    /* Один и тот же номер пропуска встречается в тексте несколько раз —
       поэтому все элементы одного номера держим вместе. */
    var spansByGap = {};

    if (data.textTemplate) {
      data.textTemplate.split(/(\{\d+\})/g).forEach(function (part) {
        var m = part.match(/\{(\d+)\}/);
        if (!m) {
          textWrap.appendChild(document.createTextNode(part));
          return;
        }
        var entry = gapMap[parseInt(m[1], 10)];
        if (!entry) {
          textWrap.appendChild(document.createTextNode(part));
          return;
        }
        var span = mk('span', 'lg-gap', '________');
        span.dataset.gapId = String(entry.gap.id);
        span.addEventListener('click', function () { openPicker(span, entry); });
        (spansByGap[entry.gap.id] = spansByGap[entry.gap.id] || []).push(span);
        textWrap.appendChild(span);
      });
    }

    function applyChoice(entry, option) {
      var ok = option === entry.gap.answer;
      (spansByGap[entry.gap.id] || []).forEach(function (span) {
        span.textContent = option;
        span.classList.remove('filled-ok', 'filled-err');
        span.classList.add(ok ? 'filled-ok' : 'filled-err');
      });
      return ok;
    }

    function openPicker(span, entry) {
      if (span.classList.contains('filled-ok')) return;
      var old = document.querySelector('.lg-popup');
      if (old) old.remove();
      var popup = mk('div', 'lg-popup');
      shuf(entry.gap.options).forEach(function (option) {
        var btn = mk('button', '', option);
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var ok = applyChoice(entry, option);
          P.setItem(id, entry.index, ok, option);
          popup.remove();
        });
        popup.appendChild(btn);
      });
      var rect = span.getBoundingClientRect();
      popup.style.position = 'fixed';
      popup.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';
      popup.style.top = (rect.bottom + 5) + 'px';
      document.body.appendChild(popup);
      var close = function (ev) {
        if (!popup.contains(ev.target) && ev.target !== span) {
          popup.remove();
          document.removeEventListener('click', close);
        }
      };
      setTimeout(function () { document.addEventListener('click', close); }, 10);
    }

    r.bb.appendChild(textWrap);

    gaps.forEach(function (gap, index) {
      var saved = P.savedItem(id, index);
      if (saved && saved.v) applyChoice({ gap: gap, index: index }, saved.v);
    });

    return r.b;
  }

  /* --- 14. Чтение вслух --- */
  function readingPractice(data, n, id) {
    P.register(id, 'Reading Practice', 1, 'score');
    var r = block(n, '🎤 Reading Practice', 'read aloud', id);

    r.bb.appendChild(mk('div', 'rp-text', data.text));
    r.bb.appendChild(mk('p', '', 'Нажмите «Start reading», прочитайте текст вслух и нажмите «Stop mic» — прогресс посчитается по распознанным словам.'));

    var bar = mk('div', '');
    bar.style.cssText = 'display:flex;gap:10px;margin:14px 0;flex-wrap:wrap';

    var startBtn = mk('button', 'cbtn', '🎤 Start reading');
    startBtn.style.cssText += 'padding:12px 24px;font-size:.9rem;width:auto';
    var stopBtn = mk('button', 'cbtn', '⏹ Stop mic');
    stopBtn.style.cssText += 'padding:12px 24px;font-size:.9rem;width:auto;display:none';
    var listenBtn = mk('button', 'cbtn', '🎧 Listen to sample');
    listenBtn.style.cssText += 'padding:12px 24px;font-size:.9rem;width:auto';
    var stopSpeaker = mk('button', 'cbtn', '⏹ Stop speaker');
    stopSpeaker.style.cssText += 'padding:12px 24px;font-size:.9rem;width:auto';
    stopSpeaker.onclick = function () {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };

    bar.appendChild(startBtn);
    bar.appendChild(stopBtn);
    bar.appendChild(listenBtn);
    bar.appendChild(stopSpeaker);
    r.bb.appendChild(bar);

    var transcript = mk('div', 'rp-transcript', 'Нажмите «Start reading» и говорите…');
    r.bb.appendChild(transcript);

    var scoreWrap = mk('div', 'rp-score-wrap');
    scoreWrap.style.display = 'none';
    var circle = mk('div', 'rp-score-circle', '-');
    var info = mk('div', 'rp-score-info');
    var label = mk('div', '', 'Ожидание…');
    var barTrack = mk('div', 'rp-bar');
    var barFill = mk('div', 'rp-bar-fill');
    barFill.style.cssText = 'width:0%;background:var(--ac)';
    barTrack.appendChild(barFill);
    info.appendChild(label);
    info.appendChild(barTrack);
    scoreWrap.appendChild(circle);
    scoreWrap.appendChild(info);
    r.bb.appendChild(scoreWrap);

    var missedBox = mk('div', 'rp-mistakes');
    missedBox.style.display = 'none';
    r.bb.appendChild(missedBox);

    function showScore(pct, correctWords, totalWords) {
      circle.textContent = Math.round(pct / 10);
      label.textContent = Math.round(pct / 10) + ' / 10 баллов · ' +
        (correctWords != null ? correctWords + '/' + totalWords + ' слов' : pct + '%');
      barFill.style.width = pct + '%';
      barFill.style.background = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--ac)' : 'var(--red)';
      scoreWrap.style.display = 'flex';
    }

    var savedScore = P.savedScore(id);
    if (savedScore > 0) {
      showScore(savedScore, null, null);
      transcript.textContent = 'Прошлый результат восстановлен: ' + savedScore + '%. Можно прочитать ещё раз — засчитается лучший результат.';
    }

    var recognition = null;
    var finalText = '';

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SR();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = function (event) {
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript + ' ';
          else interim += res[0].transcript;
        }
        transcript.textContent = (finalText + interim) || 'Слушаю…';
      };
      recognition.onerror = function (event) {
        transcript.textContent = 'Ошибка распознавания: ' + event.error;
        stopBtn.style.display = 'none';
        startBtn.style.display = 'inline-block';
      };
      recognition.onend = function () {
        stopBtn.style.display = 'none';
        startBtn.style.display = 'inline-block';
        if (finalText.trim()) checkReading(finalText.trim());
      };
    } else {
      startBtn.disabled = true;
      startBtn.textContent = '⚠ Браузер не поддерживает распознавание';
      startBtn.style.opacity = '0.5';
      transcript.textContent = 'Распознавание речи доступно в Chrome и Edge.';
    }

    startBtn.addEventListener('click', function () {
      finalText = '';
      transcript.textContent = 'Слушаю…';
      missedBox.style.display = 'none';
      try { recognition.start(); } catch (e) {}
      startBtn.style.display = 'none';
      stopBtn.style.display = 'inline-block';
    });

    stopBtn.addEventListener('click', function () {
      try { recognition.stop(); } catch (e) {}
      stopBtn.style.display = 'none';
      startBtn.style.display = 'inline-block';
    });

    listenBtn.addEventListener('click', function () {
      if (!('speechSynthesis' in window)) return;
      var u = new SpeechSynthesisUtterance(data.text);
      u.lang = 'en-US';
      u.rate = 0.85;
      speechSynthesis.speak(u);
    });

    function checkReading(spoken) {
      var original = data.text.toLowerCase().replace(/[.,!?;:]/g, '');
      var said = spoken.toLowerCase().replace(/[.,!?;:]/g, '');
      var words = original.split(/\s+/).filter(Boolean);
      var saidSet = new Set(said.split(/\s+/).filter(Boolean));
      var correct = 0;
      var missed = [];

      words.forEach(function (word) {
        if (saidSet.has(word)) { correct++; return; }
        var found = false;
        saidSet.forEach(function (sw) {
          if (!found && similarity(word, sw) > 0.75) found = true;
        });
        if (found) correct++;
        else missed.push(word);
      });

      var pct = Math.round((correct / words.length) * 100);
      showScore(pct, correct, words.length);
      P.setScore(id, pct);

      if (missed.length) {
        var html = '<b>❌ Не распознано:</b><ul>';
        missed.forEach(function (w) { html += '<li><span>' + w + '</span></li>'; });
        html += '</ul>';
        missedBox.innerHTML = html;
        missedBox.style.display = 'block';
      } else {
        missedBox.innerHTML = '<b style="color:var(--green)">🎯 Отличное произношение!</b>';
        missedBox.style.display = 'block';
      }

      var highlighted = data.text;
      missed.forEach(function (w) {
        highlighted = highlighted.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'),
          '<span class="rp-missed">' + w + '</span>');
      });
      transcript.innerHTML = highlighted || spoken;
    }

    function similarity(a, b) {
      if (a.length === 0) return b.length === 0 ? 1 : 0;
      if (b.length === 0) return 0;
      var matrix = [];
      for (var i = 0; i <= b.length; i++) matrix[i] = [i];
      for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
          matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
            ? matrix[i - 1][j - 1]
            : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
      return 1 - matrix[b.length][a.length] / Math.max(a.length, b.length);
    }

    return r.b;
  }

  /* --- 15. Видео и аудио --- */
  function videoBlock(src, n, id) {
    P.register(id, 'Video', 1, 'mark');
    var r = block(n, 'Video', 'educational video', id);
    var v = mk('video');
    v.controls = true;
    var s = mk('source');
    s.src = src;
    s.type = 'video/mp4';
    v.appendChild(s);
    var fallback = mk('p', 'mark-hint', 'Если видео не воспроизводится, проверьте, что файл ' + src + ' лежит рядом со страницей урока.');
    fallback.style.display = 'none';
    v.addEventListener('error', function () { fallback.style.display = 'block'; }, true);
    r.bb.appendChild(v);
    r.bb.appendChild(fallback);
    r.bb.appendChild(markButton(id, 'Отметьте, когда посмотрите видео.'));
    return r.b;
  }

  function audioBlock(src, n, id) {
    P.register(id, 'Audio', 1, 'mark');
    var r = block(n, 'Audio', 'audio recording', id);
    var a = mk('audio');
    a.controls = true;
    var s = mk('source');
    s.src = src;
    s.type = 'audio/mpeg';
    a.appendChild(s);
    r.bb.appendChild(a);
    r.bb.appendChild(markButton(id, 'Отметьте, когда прослушаете запись.'));
    return r.b;
  }

  /* ================================================================
     ФИНАЛЬНЫЙ ТЕСТ
     ================================================================ */

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildTestQuestions() {
    var all = [];

    function pushMcq(question, correct, pool) {
      var others = pool.filter(function (x) { return x !== correct; });
      others = Array.from(new Set(others));
      others = shuffleArray(others).slice(0, 3);
      while (others.length < 3) others.push('???');
      all.push({
        type: 'mcq',
        question: question,
        options: shuffleArray([correct].concat(others)),
        answer: correct
      });
    }

    if (L.vocabulary) {
      L.vocabulary.forEach(function (item) {
        pushMcq('Как переводится «' + item.word + '»?', item.ru, L.vocabulary.map(function (v) { return v.ru; }));
      });
    }
    if (L.translatePhrases) {
      L.translatePhrases.forEach(function (p) {
        pushMcq('Переведите на русский: «' + p.en + '»', p.ru, L.translatePhrases.map(function (x) { return x.ru; }));
      });
    }
    if (L.matching) {
      L.matching.forEach(function (m) {
        pushMcq('Какой термин соответствует определению? «' + m.def + '»', m.term, L.matching.map(function (x) { return x.term; }));
      });
    }
    if (L.fillBlanks) {
      L.fillBlanks.forEach(function (fb) {
        if (String(fb.answer).indexOf('first gap') !== -1) return;
        var pool = L.fillBlanks
          .map(function (f) { return f.answer; })
          .filter(function (a) { return String(a).indexOf('first gap') === -1; });
        if (L.vocabulary) pool = pool.concat(L.vocabulary.map(function (v) { return v.word; }));
        pushMcq('Вставьте пропущенное слово: «' + (fb.before + ' ______ ' + (fb.after || '')).trim() + '»', fb.answer, pool);
      });
    }

    return shuffleArray(all).slice(0, 30);
  }

  var testQ = [], testIndex = 0, testAnswers = [], testStart = 0, testTimer = null;

  function startTest() {
    testQ = buildTestQuestions();
    if (!testQ.length) {
      alert('Для теста недостаточно данных в этом уроке.');
      return;
    }
    testIndex = 0;
    testAnswers = new Array(testQ.length).fill(null);
    testStart = Date.now();
    $('testModal').classList.add('active');
    $('testTitle').textContent = 'ТЕСТ — урок ' + L.number;
    document.body.style.overflow = 'hidden';
    $('testNext').onclick = nextTestQuestion;
    showTestQuestion();
    if (testTimer) clearInterval(testTimer);
    testTimer = setInterval(function () {
      var e = Math.floor((Date.now() - testStart) / 1000);
      $('testTimer').textContent = '⏱ ' + Math.floor(e / 60) + ':' + String(e % 60).padStart(2, '0');
    }, 1000);
  }

  function showTestQuestion() {
    var q = testQ[testIndex];
    var body = $('testBody');
    body.innerHTML = '';
    $('testProgress').textContent = 'Вопрос ' + (testIndex + 1) + '/' + testQ.length;
    $('testBar').style.width = ((testIndex / testQ.length) * 100) + '%';
    $('testPrev').style.visibility = testIndex > 0 ? 'visible' : 'hidden';
    $('testNext').textContent = testIndex === testQ.length - 1 ? 'Завершить →' : 'Далее →';
    body.appendChild(mk('h3', '', 'Выберите вариант'));
    body.appendChild(mk('div', 'test-question', q.question));
    var opts = mk('div', 'test-options');
    q.options.forEach(function (option) {
      var el = mk('div', 'test-option', option);
      if (testAnswers[testIndex] === option) el.classList.add('selected');
      el.addEventListener('click', function () {
        testAnswers[testIndex] = option;
        showTestQuestion();
      });
      opts.appendChild(el);
    });
    body.appendChild(opts);
  }

  function nextTestQuestion() {
    if (testIndex < testQ.length - 1) {
      testIndex++;
      showTestQuestion();
    } else {
      showTestResult();
    }
  }

  function prevTestQuestion() {
    if (testIndex > 0) {
      testIndex--;
      showTestQuestion();
    }
  }

  function showTestResult() {
    if (testTimer) { clearInterval(testTimer); testTimer = null; }
    var elapsed = Math.floor((Date.now() - testStart) / 1000);
    var minutes = Math.floor(elapsed / 60);
    var seconds = elapsed % 60;
    var correct = 0;
    var mistakes = [];

    testQ.forEach(function (q, i) {
      var given = (testAnswers[i] || '').trim();
      if (given === q.answer) correct++;
      else mistakes.push({ q: q, given: given });
    });

    var pct = Math.round((correct / testQ.length) * 100);
    P.setScore('test', pct);

    $('testTitle').textContent = '🎉 ТЕСТ ЗАВЕРШЁН';
    $('testProgress').textContent = '';
    $('testTimer').textContent = '⏱ ' + minutes + ':' + String(seconds).padStart(2, '0');
    $('testBar').style.width = '100%';
    $('testPrev').style.visibility = 'hidden';
    $('testNext').textContent = '🔄 Пройти заново';
    $('testNext').onclick = function () { closeTest(); startTest(); };

    var html = '<div class="test-result"><div class="result-circle">' + pct + '%</div>' +
      '<h2 style="color:var(--text);margin-bottom:10px">' + correct + '/' + testQ.length + '</h2>' +
      '<div class="result-details">Время: <b>' + minutes + ' мин ' + seconds + ' сек</b></div>';

    if (mistakes.length) {
      html += '<div class="result-details" style="margin-top:16px;text-align:left"><b>❌ Ошибки:</b><br>';
      mistakes.forEach(function (m, i) {
        html += '<br>' + (i + 1) + '. ' + m.q.question + '<br> → правильно: <b>' + m.q.answer + '</b>' +
          ' | ваш ответ: <span style="color:var(--red)">' + (m.given || '(нет ответа)') + '</span>';
      });
      html += '</div>';
    } else {
      html += '<div class="result-details" style="color:var(--green);margin-top:16px">🎯 Все ответы верны!</div>';
    }
    html += '</div>';
    $('testBody').innerHTML = html;

    var summary = $('finalSummary');
    if (summary) {
      summary.innerHTML = 'Лучший результат теста: <b>' + P.savedScore('test') + '%</b> — он и учитывается в прогрессе темы.';
      summary.style.display = 'block';
    }
  }

  function closeTest() {
    if (testTimer) { clearInterval(testTimer); testTimer = null; }
    $('testModal').classList.remove('active');
    document.body.style.overflow = '';
    $('testNext').onclick = nextTestQuestion;
  }

  /* ================================================================
     ПРОСМОТР КАРТИНОК
     ================================================================ */

  function openImage(el) {
    var modal = $('imageModal');
    if (!modal) return;
    $('modalImage').src = el.src;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeImage() {
    var modal = $('imageModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  window.openImage = openImage;
  window.closeImage = closeImage;

  /* ================================================================
     СБОРКА СТРАНИЦЫ
     ================================================================ */

  function render() {
    document.title = 'Урок ' + L.number + ' — ' + L.title;
    var tag = $('heroTag');
    var title = $('heroTitle');
    if (tag) tag.textContent = 'Урок ' + L.number;
    if (title) title.innerHTML = String(L.title).replace(/(\S+)$/, '<em>$1</em>');

    var main = $('main');
    var n = 1;
    var pad = function (x) { return String(x).padStart(2, '0'); };
    var add = function (el) { if (el) main.appendChild(el); };

    if (L.vocabulary) { add(vocab(L.vocabulary, pad(n), 'voc')); n++; }
    if (L.translatePhrases) {
      add(translateRows(L.translatePhrases, pad(n), 'tp', {
        title: 'Translate Word Combinations', sub: 'translate phrases',
        from: 'en', to: 'ru', placeholder: 'введите перевод…'
      }));
      n++;
    }
    if (L.text) { add(textBlock(L.text, pad(n), 'txt')); n++; }
    if (L.trueFalse) { add(trueFalse(L.trueFalse, pad(n), 'tf')); n++; }
    if (L.translateToEnglish) {
      add(translateRows(L.translateToEnglish, pad(n), 'te', {
        title: 'Translate into English', sub: 'translate into english',
        from: 'ru', to: 'en', placeholder: 'type in English…'
      }));
      n++;
    }
    if (L.matching) { add(matching(L.matching, pad(n), 'm')); n++; }
    if (L.matchPicture) { add(matchPicture(L.matchPicture, pad(n), 'mp')); n++; }
    if (L.mindMap) { add(mindMap(L.mindMap, pad(n), 'mm')); n++; }
    if (L.logicalSequence) { add(logicalSequence(L.logicalSequence, pad(n), 'ls')); n++; }
    if (L.labelDiagram) { add(labelDiagram(L.labelDiagram, pad(n), 'ld')); n++; }
    if (L.fillTable) { add(fillTable(L.fillTable, pad(n), 'ft')); n++; }
    if (L.fillBlanks) { add(fillBlanks(L.fillBlanks, pad(n), 'fb')); n++; }
    if (L.jumble) { add(jumble(L.jumble, pad(n), 'j')); n++; }
    if (L.listeningGapFill) { add(listeningGapFill(L.listeningGapFill, pad(n), 'lg')); n++; }
    if (L.readingPractice) { add(readingPractice(L.readingPractice, pad(n), 'rp')); n++; }
    if (L.video) { add(videoBlock(L.video, pad(n), 'vid')); n++; }
    if (L.audio) { add(audioBlock(L.audio, pad(n), 'aud')); n++; }

    /* Финальный тест. */
    P.register('test', 'Final test', 1, 'score');
    var testBlock = block(pad(n), 'Финальный тест', 'до 30 вопросов по уроку', 'test');
    testBlock.bb.innerHTML =
      '<p style="color:var(--muted);font-size:.92rem;margin-bottom:16px">' +
      'Проверьте себя: тест собирается случайно из материала урока. ' +
      'В прогрессе учитывается процент правильных ответов (лучший результат).</p>' +
      '<button class="cbtn" id="startTestBtn" style="padding:12px 28px;font-size:.9rem;width:auto">Начать тест</button>' +
      '<div class="final-summary" id="finalSummary" style="display:none"></div>';
    main.appendChild(testBlock.b);
    $('startTestBtn').addEventListener('click', startTest);

    if (P.savedScore('test') > 0) {
      var summary = $('finalSummary');
      summary.innerHTML = 'Лучший результат теста: <b>' + P.savedScore('test') + '%</b> — он и учитывается в прогрессе темы.';
      summary.style.display = 'block';
    }

    /* Сброс прогресса темы. */
    var tools = mk('div', 'lesson-tools');
    var resetAll = mk('button', 'cbtn danger', 'Сбросить прогресс темы');
    resetAll.onclick = async function () {
      if (!confirm('Сбросить весь прогресс по этой теме? Ответы будут удалены.')) return;
      await P.reset();
      location.reload();
    };
    tools.appendChild(resetAll);
    main.appendChild(tools);

    P.paintAll();
  }

  /* ================================================================
     ЗАПУСК
     ================================================================ */

  document.addEventListener('DOMContentLoaded', async function () {
    /* Кнопки теста и картинок доступны сразу. */
    var prev = $('testPrev');
    var next = $('testNext');
    if (prev) prev.addEventListener('click', prevTestQuestion);
    if (next) next.addEventListener('click', nextTestQuestion);
    var overlay = document.querySelector('.test-overlay');
    if (overlay) overlay.addEventListener('click', closeTest);

    document.addEventListener('keydown', function (e) {
      var modal = $('testModal');
      if (modal && modal.classList.contains('active')) {
        if (e.key === 'Enter') nextTestQuestion();
        if (e.key === 'ArrowLeft') prevTestQuestion();
        if (e.key === 'Escape') closeTest();
        return;
      }
      var img = $('imageModal');
      if (e.key === 'Escape' && img && img.classList.contains('active')) closeImage();
    });

    var scrollTop = $('scrollTop');
    if (scrollTop) {
      window.addEventListener('scroll', function () {
        scrollTop.classList.toggle('visible', window.scrollY > 300);
      });
      scrollTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* Урок доступен только вошедшим — прогресс некуда писать без аккаунта. */
    var user = await window.App.requireAuth();
    if (!user) return;

    window.App.showModeNotice();

    var box = $('headerUser');
    if (box) window.App.renderUserBox(box, user);

    var back = $('backLink');
    if (back) back.href = 'index.html';

    await P.load();
    render();
  });
})();
