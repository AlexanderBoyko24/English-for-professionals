/* ================================================================
   СЛОЙ ДАННЫХ
   ----------------------------------------------------------------
   Один и тот же интерфейс работает в двух режимах:

   • cloud — если в assets/config.js заданы ключи Supabase.
     Аккаунты, роли, группы и прогресс лежат в общей базе,
     доступны с любого устройства, работает вход через Google.

   • local — если ключи не заданы. Всё хранится в localStorage
     этого браузера. Режим для просмотра и отладки без сервера.

   Наружу отдаётся window.API, все методы асинхронные.
   ================================================================ */

(function () {
  'use strict';

  var cfg = window.APP_CONFIG || {};
  var CLOUD = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var SUPABASE_CDN =
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  /* ---------------- общие мелочи ---------------- */

  function root() {
    return window.APP_ROOT || '';
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error('Не удалось загрузить ' + src));
      };
      document.head.appendChild(s);
    });
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* Хеш пароля для локального режима. Это не замена серверной
     авторизации — просто чтобы пароль не лежал в браузере открытым. */
  async function hashPassword(pw) {
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pe:' + pw));
      return Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    }
    var h = 0;
    var s = 'pe:' + pw;
    for (var i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return 'weak-' + (h >>> 0).toString(16);
  }

  function splitTopicKey(topicKey) {
    var p = String(topicKey).split('/');
    return { course: p[0] || '', subcourse: p[1] || '', topic: p[2] || '' };
  }

  /* ================================================================
     ЛОКАЛЬНЫЙ РЕЖИМ
     ================================================================ */

  var LS = {
    users: 'pe_users',
    session: 'pe_session',
    groups: 'pe_groups',
    members: 'pe_group_members',
    progress: function (userId) { return 'pe_progress_' + userId; }
  };

  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Не удалось сохранить в localStorage:', e);
    }
  }

  function publicUser(u) {
    if (!u) return null;
    return { id: u.id, email: u.email, fullName: u.fullName, role: u.role };
  }

  var LocalBackend = {
    mode: 'local',

    init: function () {
      return Promise.resolve();
    },

    /* ---- авторизация ---- */

    currentUser: async function () {
      var id = lsGet(LS.session, null);
      if (!id) return null;
      var users = lsGet(LS.users, []);
      var found = users.filter(function (u) { return u.id === id; })[0];
      return publicUser(found);
    },

    signUp: async function (opts) {
      var users = lsGet(LS.users, []);
      var email = String(opts.email || '').trim().toLowerCase();
      var exists = users.some(function (u) { return u.email === email; });
      if (exists) throw new Error('Пользователь с такой почтой уже зарегистрирован.');
      var user = {
        id: uid(),
        email: email,
        fullName: String(opts.fullName || '').trim(),
        role: opts.role === 'teacher' ? 'teacher' : 'student',
        passwordHash: await hashPassword(opts.password),
        createdAt: new Date().toISOString()
      };
      users.push(user);
      lsSet(LS.users, users);
      lsSet(LS.session, user.id);
      return { user: publicUser(user), needsEmailConfirmation: false };
    },

    signIn: async function (opts) {
      var users = lsGet(LS.users, []);
      var email = String(opts.email || '').trim().toLowerCase();
      var user = users.filter(function (u) { return u.email === email; })[0];
      if (!user) throw new Error('Пользователь с такой почтой не найден.');
      var hash = await hashPassword(opts.password);
      if (hash !== user.passwordHash) throw new Error('Неверный пароль.');
      lsSet(LS.session, user.id);
      return { user: publicUser(user) };
    },

    signInWithGoogle: async function () {
      throw new Error(
        'Вход через Google работает только после подключения Supabase. ' +
        'Заполните assets/config.js — как это сделать, написано в SETUP.md.'
      );
    },

    signOut: async function () {
      localStorage.removeItem(LS.session);
    },

    updateProfile: async function (patch) {
      var id = lsGet(LS.session, null);
      if (!id) throw new Error('Вы не вошли в аккаунт.');
      var users = lsGet(LS.users, []);
      users.forEach(function (u) {
        if (u.id !== id) return;
        if (patch.fullName != null) u.fullName = String(patch.fullName).trim();
        if (patch.role === 'student' || patch.role === 'teacher') u.role = patch.role;
      });
      lsSet(LS.users, users);
      return publicUser(users.filter(function (u) { return u.id === id; })[0]);
    },

    /* ---- прогресс ---- */

    getTopicProgress: async function (topicKey, userId) {
      var id = userId || lsGet(LS.session, null);
      if (!id) return null;
      var all = lsGet(LS.progress(id), {});
      return all[topicKey] || null;
    },

    saveTopicProgress: async function (topicKey, payload) {
      var id = lsGet(LS.session, null);
      if (!id) return;
      var parts = splitTopicKey(topicKey);
      var all = lsGet(LS.progress(id), {});
      all[topicKey] = {
        percent: payload.percent,
        state: payload.state,
        courseKey: parts.course,
        subcourseKey: parts.subcourse,
        updatedAt: new Date().toISOString()
      };
      lsSet(LS.progress(id), all);
    },

    listProgress: async function (userId) {
      var id = userId || lsGet(LS.session, null);
      if (!id) return [];
      var all = lsGet(LS.progress(id), {});
      return Object.keys(all).map(function (k) {
        return {
          topicKey: k,
          percent: all[k].percent || 0,
          updatedAt: all[k].updatedAt || null
        };
      });
    },

    resetTopicProgress: async function (topicKey) {
      var id = lsGet(LS.session, null);
      if (!id) return;
      var all = lsGet(LS.progress(id), {});
      delete all[topicKey];
      lsSet(LS.progress(id), all);
    },

    /* ---- студенты и группы ---- */

    searchStudents: async function (query) {
      var q = String(query || '').trim().toLowerCase();
      var users = lsGet(LS.users, []);
      return users
        .filter(function (u) { return u.role === 'student'; })
        .filter(function (u) {
          if (!q) return true;
          return (
            u.email.toLowerCase().indexOf(q) !== -1 ||
            (u.fullName || '').toLowerCase().indexOf(q) !== -1
          );
        })
        .map(publicUser);
    },

    listGroups: async function () {
      var me = lsGet(LS.session, null);
      var groups = lsGet(LS.groups, []).filter(function (g) { return g.teacherId === me; });
      var members = lsGet(LS.members, []);
      var users = lsGet(LS.users, []);
      return groups.map(function (g) {
        var studentIds = members
          .filter(function (m) { return m.groupId === g.id; })
          .map(function (m) { return m.studentId; });
        return {
          id: g.id,
          name: g.name,
          createdAt: g.createdAt,
          students: studentIds
            .map(function (sid) {
              return publicUser(users.filter(function (u) { return u.id === sid; })[0]);
            })
            .filter(Boolean)
        };
      });
    },

    createGroup: async function (name) {
      var me = lsGet(LS.session, null);
      if (!me) throw new Error('Вы не вошли в аккаунт.');
      var groups = lsGet(LS.groups, []);
      var group = { id: uid(), name: String(name).trim(), teacherId: me, createdAt: new Date().toISOString() };
      groups.push(group);
      lsSet(LS.groups, groups);
      return group;
    },

    renameGroup: async function (groupId, name) {
      var groups = lsGet(LS.groups, []);
      groups.forEach(function (g) { if (g.id === groupId) g.name = String(name).trim(); });
      lsSet(LS.groups, groups);
    },

    deleteGroup: async function (groupId) {
      lsSet(LS.groups, lsGet(LS.groups, []).filter(function (g) { return g.id !== groupId; }));
      lsSet(LS.members, lsGet(LS.members, []).filter(function (m) { return m.groupId !== groupId; }));
    },

    addStudentToGroup: async function (groupId, studentId) {
      var members = lsGet(LS.members, []);
      var already = members.some(function (m) {
        return m.groupId === groupId && m.studentId === studentId;
      });
      if (already) return;
      members.push({ groupId: groupId, studentId: studentId });
      lsSet(LS.members, members);
    },

    removeStudentFromGroup: async function (groupId, studentId) {
      lsSet(
        LS.members,
        lsGet(LS.members, []).filter(function (m) {
          return !(m.groupId === groupId && m.studentId === studentId);
        })
      );
    }
  };

  /* ================================================================
     РЕЖИМ SUPABASE
     ================================================================ */

  var sb = null;

  /* Роль, выбранную перед входом через Google, запоминаем здесь:
     провайдер её не передаёт, поэтому проставим после возврата. */
  var PENDING_ROLE = 'pe_pending_role';

  var CloudBackend = {
    mode: 'cloud',

    init: async function () {
      if (!window.supabase) await loadScript(SUPABASE_CDN);
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    },

    /* ---- авторизация ---- */

    currentUser: async function () {
      var res = await sb.auth.getUser();
      var user = res.data && res.data.user;
      if (!user) return null;

      var prof = await sb
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', user.id)
        .maybeSingle();

      /* Профиль создаёт триггер базы. Если его почему-то нет
         (например, пользователь заведён до установки схемы) — создаём. */
      var row = prof.data;
      if (!row) {
        var meta = user.user_metadata || {};
        var insert = await sb
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: meta.full_name || meta.name || '',
            role: meta.role === 'teacher' ? 'teacher' : 'student'
          })
          .select('id, email, full_name, role')
          .single();
        if (insert.error) throw insert.error;
        row = insert.data;
      }

      /* Роль, выбранная перед входом через Google. */
      var pending = null;
      try { pending = sessionStorage.getItem(PENDING_ROLE); } catch (e) {}
      if (pending && (pending === 'teacher' || pending === 'student') && pending !== row.role) {
        var upd = await sb
          .from('profiles')
          .update({ role: pending })
          .eq('id', user.id)
          .select('id, email, full_name, role')
          .single();
        if (!upd.error) row = upd.data;
      }
      try { sessionStorage.removeItem(PENDING_ROLE); } catch (e) {}

      /* Имя из Google, если своё ещё не заполнено. */
      if (!row.full_name) {
        var m = user.user_metadata || {};
        var name = m.full_name || m.name || '';
        if (name) {
          var r2 = await sb
            .from('profiles')
            .update({ full_name: name })
            .eq('id', user.id)
            .select('id, email, full_name, role')
            .single();
          if (!r2.error) row = r2.data;
        }
      }

      return { id: row.id, email: row.email, fullName: row.full_name, role: row.role };
    },

    signUp: async function (opts) {
      var res = await sb.auth.signUp({
        email: String(opts.email || '').trim(),
        password: opts.password,
        options: {
          data: {
            full_name: String(opts.fullName || '').trim(),
            role: opts.role === 'teacher' ? 'teacher' : 'student'
          },
          emailRedirectTo: new URL(root() + 'auth.html', location.href).href
        }
      });
      if (res.error) throw res.error;
      return {
        user: res.data.user ? { id: res.data.user.id, email: res.data.user.email } : null,
        needsEmailConfirmation: !res.data.session
      };
    },

    signIn: async function (opts) {
      var res = await sb.auth.signInWithPassword({
        email: String(opts.email || '').trim(),
        password: opts.password
      });
      if (res.error) throw res.error;
      return { user: { id: res.data.user.id, email: res.data.user.email } };
    },

    signInWithGoogle: async function (role) {
      try {
        if (role) sessionStorage.setItem(PENDING_ROLE, role);
      } catch (e) {}
      var res = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL(root() + 'auth.html', location.href).href }
      });
      if (res.error) throw res.error;
    },

    signOut: async function () {
      await sb.auth.signOut();
    },

    updateProfile: async function (patch) {
      var res = await sb.auth.getUser();
      var user = res.data && res.data.user;
      if (!user) throw new Error('Вы не вошли в аккаунт.');
      var fields = {};
      if (patch.fullName != null) fields.full_name = String(patch.fullName).trim();
      if (patch.role === 'student' || patch.role === 'teacher') fields.role = patch.role;
      var upd = await sb
        .from('profiles')
        .update(fields)
        .eq('id', user.id)
        .select('id, email, full_name, role')
        .single();
      if (upd.error) throw upd.error;
      return { id: upd.data.id, email: upd.data.email, fullName: upd.data.full_name, role: upd.data.role };
    },

    /* ---- прогресс ---- */

    getTopicProgress: async function (topicKey, userId) {
      var id = userId;
      if (!id) {
        var res = await sb.auth.getUser();
        id = res.data && res.data.user && res.data.user.id;
      }
      if (!id) return null;
      var row = await sb
        .from('topic_progress')
        .select('percent, state, updated_at')
        .eq('user_id', id)
        .eq('topic_key', topicKey)
        .maybeSingle();
      if (row.error) throw row.error;
      if (!row.data) return null;
      return { percent: row.data.percent, state: row.data.state, updatedAt: row.data.updated_at };
    },

    saveTopicProgress: async function (topicKey, payload) {
      var res = await sb.auth.getUser();
      var user = res.data && res.data.user;
      if (!user) return;
      var parts = splitTopicKey(topicKey);
      var up = await sb.from('topic_progress').upsert(
        {
          user_id: user.id,
          topic_key: topicKey,
          course_key: parts.course,
          subcourse_key: parts.subcourse,
          percent: payload.percent,
          state: payload.state
        },
        { onConflict: 'user_id,topic_key' }
      );
      if (up.error) throw up.error;
    },

    listProgress: async function (userId) {
      var id = userId;
      if (!id) {
        var res = await sb.auth.getUser();
        id = res.data && res.data.user && res.data.user.id;
      }
      if (!id) return [];
      var rows = await sb
        .from('topic_progress')
        .select('topic_key, percent, updated_at')
        .eq('user_id', id);
      if (rows.error) throw rows.error;
      return (rows.data || []).map(function (r) {
        return { topicKey: r.topic_key, percent: r.percent, updatedAt: r.updated_at };
      });
    },

    resetTopicProgress: async function (topicKey) {
      var res = await sb.auth.getUser();
      var user = res.data && res.data.user;
      if (!user) return;
      await sb.from('topic_progress').delete().eq('user_id', user.id).eq('topic_key', topicKey);
    },

    /* ---- студенты и группы ---- */

    searchStudents: async function (query) {
      var q = String(query || '').trim();
      var req = sb.from('profiles').select('id, email, full_name, role').eq('role', 'student');
      if (q) {
        var safe = q.replace(/[,()]/g, ' ');
        req = req.or('full_name.ilike.%' + safe + '%,email.ilike.%' + safe + '%');
      }
      var rows = await req.order('full_name').limit(50);
      if (rows.error) throw rows.error;
      return (rows.data || []).map(function (r) {
        return { id: r.id, email: r.email, fullName: r.full_name, role: r.role };
      });
    },

    listGroups: async function () {
      var res = await sb.auth.getUser();
      var user = res.data && res.data.user;
      if (!user) return [];
      var rows = await sb
        .from('groups')
        .select('id, name, created_at, group_members(student_id, profiles(id, email, full_name))')
        .eq('teacher_id', user.id)
        .order('created_at');
      if (rows.error) throw rows.error;
      return (rows.data || []).map(function (g) {
        return {
          id: g.id,
          name: g.name,
          createdAt: g.created_at,
          students: (g.group_members || [])
            .map(function (m) {
              if (!m.profiles) return null;
              return { id: m.profiles.id, email: m.profiles.email, fullName: m.profiles.full_name, role: 'student' };
            })
            .filter(Boolean)
        };
      });
    },

    createGroup: async function (name) {
      var res = await sb.auth.getUser();
      var user = res.data && res.data.user;
      if (!user) throw new Error('Вы не вошли в аккаунт.');
      var ins = await sb
        .from('groups')
        .insert({ name: String(name).trim(), teacher_id: user.id })
        .select('id, name, created_at')
        .single();
      if (ins.error) throw ins.error;
      return { id: ins.data.id, name: ins.data.name, createdAt: ins.data.created_at, students: [] };
    },

    renameGroup: async function (groupId, name) {
      var upd = await sb.from('groups').update({ name: String(name).trim() }).eq('id', groupId);
      if (upd.error) throw upd.error;
    },

    deleteGroup: async function (groupId) {
      var del = await sb.from('groups').delete().eq('id', groupId);
      if (del.error) throw del.error;
    },

    addStudentToGroup: async function (groupId, studentId) {
      var ins = await sb
        .from('group_members')
        .upsert({ group_id: groupId, student_id: studentId }, { onConflict: 'group_id,student_id' });
      if (ins.error) throw ins.error;
    },

    removeStudentFromGroup: async function (groupId, studentId) {
      var del = await sb
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('student_id', studentId);
      if (del.error) throw del.error;
    }
  };

  /* ================================================================
     ВЫБОР РЕЖИМА И ПУБЛИЧНЫЙ ИНТЕРФЕЙС
     ================================================================ */

  var backend = CLOUD ? CloudBackend : LocalBackend;
  var initFailed = null;

  var ready = backend
    .init()
    .catch(function (err) {
      /* Если Supabase не поднялся — не роняем страницу, а честно
         говорим об этом и продолжаем в локальном режиме. */
      console.error('Не удалось подключиться к Supabase:', err);
      initFailed = err;
      backend = LocalBackend;
      return LocalBackend.init();
    })
    .then(function () {
      window.API.mode = backend.mode;
      window.API.initError = initFailed;
      return backend.mode;
    });

  function forward(name) {
    return function () {
      var args = arguments;
      return ready.then(function () {
        return backend[name].apply(backend, args);
      });
    };
  }

  window.API = {
    mode: backend.mode,
    cloudConfigured: CLOUD,
    initError: null,
    ready: ready,

    auth: {
      currentUser: forward('currentUser'),
      signUp: forward('signUp'),
      signIn: forward('signIn'),
      signInWithGoogle: forward('signInWithGoogle'),
      signOut: forward('signOut'),
      updateProfile: forward('updateProfile')
    },

    progress: {
      getTopic: forward('getTopicProgress'),
      saveTopic: forward('saveTopicProgress'),
      list: forward('listProgress'),
      resetTopic: forward('resetTopicProgress')
    },

    students: {
      search: forward('searchStudents')
    },

    groups: {
      list: forward('listGroups'),
      create: forward('createGroup'),
      rename: forward('renameGroup'),
      remove: forward('deleteGroup'),
      addStudent: forward('addStudentToGroup'),
      removeStudent: forward('removeStudentFromGroup')
    }
  };
})();
