/* ================================================================
   ОБЩИЕ ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
   Тема день/ночь, шапка с профилем, защита страниц, уведомления.
   ================================================================ */

(function () {
  'use strict';

  var App = {};

  /* ---------------- пути ---------------- */

  App.root = function () {
    return window.APP_ROOT || '';
  };

  App.url = function (rel) {
    return App.root() + rel;
  };

  App.go = function (rel) {
    location.href = App.url(rel);
  };

  /* Куда ведёт «личный кабинет» для этой роли. */
  App.homeFor = function (user) {
    return user && user.role === 'teacher' ? 'teacher.html' : 'student.html';
  };

  /* ---------------- мелкие помощники ---------------- */

  App.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  App.escape = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  App.initials = function (name, email) {
    var n = String(name || '').trim();
    if (n) {
      var parts = n.split(/\s+/).slice(0, 2);
      return parts.map(function (p) { return p[0]; }).join('').toUpperCase();
    }
    return String(email || '?').slice(0, 1).toUpperCase();
  };

  App.displayName = function (user) {
    if (!user) return '';
    return user.fullName && user.fullName.trim() ? user.fullName : user.email;
  };

  App.roleLabel = function (role) {
    return role === 'teacher' ? 'Преподаватель' : 'Студент';
  };

  /* ---------------- тема ---------------- */

  App.theme = {
    apply: function (name) {
      document.documentElement.setAttribute('data-theme', name);
      try { localStorage.setItem('theme', name); } catch (e) {}
    },
    current: function () {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    },
    toggle: function () {
      App.theme.apply(App.theme.current() === 'dark' ? 'light' : 'dark');
    },
    /* Вешает переключение на все кнопки [data-theme-toggle] на странице. */
    bind: function () {
      document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
        if (btn.dataset.themeBound) return;
        btn.dataset.themeBound = '1';
        btn.addEventListener('click', App.theme.toggle);
      });
    }
  };

  /* ---------------- уведомления ---------------- */

  App.toast = function (message, kind) {
    var host = document.getElementById('appToasts');
    if (!host) {
      host = App.el('div', 'toast-host');
      host.id = 'appToasts';
      document.body.appendChild(host);
    }
    var t = App.el('div', 'toast toast-' + (kind || 'info'), App.escape(message));
    host.appendChild(t);
    setTimeout(function () { t.classList.add('toast-out'); }, 4200);
    setTimeout(function () { t.remove(); }, 4800);
  };

  /* ---------------- шапка с профилем ---------------- */

  /* Рисует правую часть шапки: либо кнопки входа, либо карточку профиля.
     container — элемент, куда всё складывается. */
  App.renderUserBox = function (container, user, opts) {
    opts = opts || {};
    container.innerHTML = '';

    if (!user) {
      if (opts.showAuthButtons !== false) {
        var login = App.el('a', 'btn btn-ghost', '<i class="fas fa-right-to-bracket"></i> Войти');
        login.href = App.url('auth.html?mode=login');
        var reg = App.el('a', 'btn btn-primary', 'Регистрация');
        reg.href = App.url('auth.html?mode=register');
        container.appendChild(login);
        container.appendChild(reg);
      }
      return;
    }

    var box = App.el('a', 'user-box');
    box.href = App.url(App.homeFor(user));
    box.title = 'Личный кабинет';
    box.innerHTML =
      '<span class="avatar">' + App.escape(App.initials(user.fullName, user.email)) + '</span>' +
      '<span class="user-meta">' +
      '<span class="user-name">' + App.escape(App.displayName(user)) + '</span>' +
      '<span class="role-badge role-' + (user.role === 'teacher' ? 'teacher' : 'student') + '">' +
      App.roleLabel(user.role) +
      '</span>' +
      '</span>';
    container.appendChild(box);

    if (opts.showLogout !== false) {
      var out = App.el('button', 'btn btn-ghost btn-icon', '<i class="fas fa-right-from-bracket"></i>');
      out.title = 'Выйти';
      out.addEventListener('click', App.logout);
      container.appendChild(out);
    }
  };

  App.logout = async function () {
    if (!confirm('Выйти из аккаунта?')) return;
    try {
      await window.API.auth.signOut();
    } catch (e) {
      console.warn(e);
    }
    location.href = App.url('index.html');
  };

  /* ---------------- защита страниц ---------------- */

  /* Возвращает пользователя. Если он не вошёл — уводит на страницу входа.
     role — необязательное ограничение ('student' | 'teacher'). */
  App.requireAuth = async function (role) {
    var user = null;
    try {
      user = await window.API.auth.currentUser();
    } catch (e) {
      console.error(e);
    }
    if (!user) {
      var back = encodeURIComponent(location.href);
      location.href = App.url('auth.html?mode=login&next=' + back);
      return null;
    }
    if (role && user.role !== role) {
      /* Роль не та — отправляем в его собственный кабинет. */
      location.href = App.url(App.homeFor(user));
      return null;
    }
    return user;
  };

  /* ---------------- прогресс ---------------- */

  App.progressClass = function (pct) {
    if (pct >= 100) return 'is-done';
    if (pct > 0) return 'is-partial';
    return 'is-empty';
  };

  /* Разметка полоски прогресса. */
  App.progressBar = function (pct, label) {
    var p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    return (
      '<div class="pbar ' + App.progressClass(p) + '">' +
      '<div class="pbar-track"><div class="pbar-fill" style="width:' + p + '%"></div></div>' +
      '<div class="pbar-label">' + (label != null ? App.escape(label) : p + '%') + '</div>' +
      '</div>'
    );
  };

  /* Средний процент по списку значений; пустой список — 0. */
  App.average = function (values) {
    if (!values.length) return 0;
    var sum = values.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum / values.length);
  };

  /* Прогресс по всем темам пользователя в удобном виде:
     { 'medical/anatomy/1': 42, ... } */
  App.progressMap = async function (userId) {
    var rows = await window.API.progress.list(userId);
    var map = {};
    rows.forEach(function (r) { map[r.topicKey] = r.percent || 0; });
    return map;
  };

  /* Считает проценты по подкурсу и курсу на основе карты тем. */
  App.subcourseProgress = function (map, courseKey, sub) {
    if (!sub.topics.length) return 0;
    return App.average(
      sub.topics.map(function (t) {
        return map[window.CATALOG.topicKey(courseKey, sub.key, t.key)] || 0;
      })
    );
  };

  App.courseProgress = function (map, course) {
    var ready = course.subcourses.filter(function (s) { return s.ready && s.topics.length; });
    if (!ready.length) return 0;
    return App.average(
      ready.map(function (s) { return App.subcourseProgress(map, course.key, s); })
    );
  };

  /* ---------------- предупреждение о локальном режиме ---------------- */

  App.showModeNotice = function () {
    if (window.API.mode !== 'local') return;
    if (document.querySelector('.mode-notice')) return;
    var text = window.API.initError
      ? 'Не удалось подключиться к базе — работает локальный режим, данные видны только в этом браузере.'
      : 'Локальный режим: аккаунты и прогресс хранятся только в этом браузере. Как подключить общую базу — см. SETUP.md.';
    var bar = App.el('div', 'mode-notice', '<i class="fas fa-circle-info"></i> ' + App.escape(text));
    document.body.insertBefore(bar, document.body.firstChild);
  };

  window.App = App;

  document.addEventListener('DOMContentLoaded', function () {
    App.theme.bind();
  });
})();
