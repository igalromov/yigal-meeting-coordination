/* =========================================================
   יגאל — תיאום פגישות | לוגיקת צד לקוח
   ---------------------------------------------------------
   מודולים:
     1) UI        — תפריט, גלילה, כפתור צף, שנה בפוטר
     2) Validate  — ולידציה לטפסים בעברית
     3) Submit    — איסוף נתונים ושליחה ל-endpoint (או DEMO)
   אין בקובץ זה מפתחות, סודות או מידע רגיש.
   ========================================================= */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var MSG = CFG.messages || {};

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* =======================================================
     1) UI
     ======================================================= */
  function initUI() {
    var yearEl = $('#year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* --- תפריט מובייל --- */
    var toggle = $('#navToggle');
    var mobileNav = $('#mobileNav');

    if (toggle && mobileNav) {
      var setNav = function (open) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
        mobileNav.hidden = !open;
      };

      toggle.addEventListener('click', function () {
        setNav(toggle.getAttribute('aria-expanded') !== 'true');
      });

      mobileNav.addEventListener('click', function (e) {
        if (e.target.closest('a')) setNav(false);
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
          setNav(false);
          toggle.focus();
        }
      });

      // סגירה אוטומטית כשעוברים לרוחב דסקטופ
      var mq = window.matchMedia('(min-width: 861px)');
      var onMq = function (e) { if (e.matches) setNav(false); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }

    /* --- צל להדר + כפתור צף --- */
    var header = $('#siteHeader');
    var floating = $('#floatingCta');
    var leadSection = $('#lead-form');

    var onScroll = function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (header) header.classList.toggle('is-scrolled', y > 8);

      if (floating) {
        var pastHero = y > 480;
        var inForm = false;
        if (leadSection) {
          var r = leadSection.getBoundingClientRect();
          // מסתירים את הכפתור הצף כשהטופס עצמו על המסך
          inForm = r.top < window.innerHeight * 0.85 && r.bottom > 120;
        }
        floating.classList.toggle('is-visible', pastHero && !inForm);
      }
    };

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { onScroll(); ticking = false; });
    }, { passive: true });
    onScroll();

    /* --- מונה תווים בשדה החופשי --- */
    var notes = $('#notes');
    var notesCount = $('#notesCount');
    if (notes && notesCount) {
      notes.addEventListener('input', function () {
        notesCount.textContent = String(notes.value.length);
      });
    }
  }

  /* =======================================================
     2) ולידציה
     ======================================================= */
  var RULES = {
    name: {
      // לפחות שתי אותיות, בכל שפה. נמנעים מטווח תווים מפורש כדי לתמוך
      // בשמות עם גרש, מקף או אותיות לא־עבריות.
      test: function (v) { return v.trim().replace(/[\s\d'"״׳.\-]/g, '').length >= 2; },
      msg: 'נא להזין שם מלא (לפחות שתי אותיות).'
    },
    phone: {
      test: function (v) {
        var digits = v.replace(/[^\d]/g, '');
        // מספר ישראלי: 9–10 ספרות המתחילות ב-0, או פורמט בין־לאומי 972
        if (/^972\d{8,9}$/.test(digits)) return true;
        return /^0\d{8,9}$/.test(digits);
      },
      msg: 'נא להזין מספר טלפון תקין, לדוגמה 050-0000000.'
    },
    email: {
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v.trim()); },
      msg: 'נא להזין כתובת אימייל תקינה.'
    },
    select: {
      test: function (v) { return v !== ''; },
      msg: 'נא לבחור אפשרות מהרשימה.'
    },
    radio: { msg: 'נא לבחור אחת מהאפשרויות.' },
    checkgroup: { msg: 'נא לבחור לפחות נושא אחד.' },
    consent: { msg: 'לא נוכל לחזור אליך ללא אישור זה.' }
  };

  function fieldOf(el) { return el.closest('.field') || el.closest('.consent'); }

  function showError(el, message) {
    var wrap = fieldOf(el);
    if (wrap) wrap.classList.add('has-error');

    var described = el.getAttribute('aria-describedby');
    var errEl = described ? document.getElementById(described.split(' ')[0]) : null;
    if (!errEl && wrap) errEl = wrap.querySelector('.err');
    if (errEl) { errEl.textContent = message; errEl.hidden = false; }

    if (el.matches('input, select, textarea')) el.setAttribute('aria-invalid', 'true');
  }

  function clearError(el) {
    var wrap = fieldOf(el);
    if (wrap) {
      wrap.classList.remove('has-error');
      var errEl = wrap.querySelector('.err');
      if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    }
    if (el.matches('input, select, textarea')) el.removeAttribute('aria-invalid');
  }

  /**
   * בודק שדה בודד. מחזיר true אם תקין.
   * anchor — האלמנט שאליו נצמיד את הודעת השגיאה (עבור קבוצות: השדה הראשון).
   */
  function validateControl(control, form) {
    var rule = control.getAttribute('data-rule');
    if (!rule) return true;

    var name = control.getAttribute('name');
    var ok;

    if (rule === 'radio') {
      ok = !!form.querySelector('input[name="' + name + '"]:checked');
    } else if (rule === 'checkgroup') {
      ok = form.querySelectorAll('input[name="' + name + '"]:checked').length > 0;
    } else if (rule === 'consent') {
      ok = control.checked;
    } else {
      var val = control.value || '';
      // שדה שאינו חובה וריק — נחשב תקין
      if (!control.hasAttribute('required') && val.trim() === '') return true;
      ok = RULES[rule] ? RULES[rule].test(val) : true;
    }

    if (ok) { clearError(control); return true; }
    showError(control, (RULES[rule] && RULES[rule].msg) || 'שדה זה נדרש.');
    return false;
  }

  function validateForm(form) {
    var controls = $$('[data-rule]', form);
    var firstInvalid = null;

    controls.forEach(function (c) {
      if (!validateControl(c, form) && !firstInvalid) firstInvalid = c;
    });

    return { valid: !firstInvalid, first: firstInvalid };
  }

  function attachLiveValidation(form) {
    $$('[data-rule]', form).forEach(function (control) {
      var name = control.getAttribute('name');
      var rule = control.getAttribute('data-rule');

      if (rule === 'radio' || rule === 'checkgroup') {
        // כל שינוי בקבוצה מנקה את השגיאה
        $$('input[name="' + name + '"]', form).forEach(function (input) {
          input.addEventListener('change', function () { validateControl(control, form); });
        });
        return;
      }

      control.addEventListener('change', function () { validateControl(control, form); });
      control.addEventListener('blur', function () {
        if (control.value && control.value.trim() !== '') validateControl(control, form);
      });
      control.addEventListener('input', function () {
        var wrap = fieldOf(control);
        if (wrap && wrap.classList.contains('has-error')) validateControl(control, form);
      });
    });
  }

  /* =======================================================
     3) שליחה
     ======================================================= */

  /** אוסף את ערכי הטופס לאובייקט אחד, כולל קבוצות checkbox */
  function collect(form) {
    var data = {};
    var fd = new FormData(form);

    fd.forEach(function (value, key) {
      if (typeof value !== 'string') return;
      var v = value.trim();
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(v);
      } else {
        data[key] = v;
      }
    });

    // ריכוז בחירות מרובות למחרוזת אחת קריאה (נוח לשורת גיליון)
    if (Array.isArray(data.topics)) data.topics = data.topics.join(', ');

    var consentEl = form.querySelector('[name="consent"]');
    if (consentEl) data.consent = consentEl.checked ? 'כן' : 'לא';

    return data;
  }

  /**
   * שולח את הליד ל-endpoint שהוגדר ב-config.js.
   * אם לא הוגדר endpoint — מצב DEMO: מחזיר הצלחה מדומה.
   */
  function sendLead(payload) {
    var endpoint = CFG.leadEndpoint;

    if (!endpoint) {
      if (window.console && console.info) {
        console.info('[DEMO] לא הוגדר leadEndpoint — הליד לא נשלח לשום מקום.', payload);
      }
      return new Promise(function (resolve) { setTimeout(resolve, 600); });
    }

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () { controller.abort(); }, CFG.requestTimeoutMs || 12000)
      : null;

    return fetch(endpoint, {
      method: 'POST',
      // text/plain נמנע מ-preflight מול Google Apps Script
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
    btn.setAttribute('aria-busy', String(loading));
    var label = btn.querySelector('.btn-label');
    if (label) label.textContent = loading ? 'שולח…' : btn.dataset.label;
  }

  /**
   * מחבר טופס למחזור המלא: ולידציה → שליחה → הודעת הצלחה.
   */
  function initForm(opts) {
    var form = $(opts.form);
    if (!form) return;

    var btn = $(opts.button);
    var success = $(opts.success);
    var resetBtn = $(opts.reset);
    var summary = $(opts.summary);
    var honeypot = form.querySelector(opts.honeypot);

    if (btn) {
      var label = btn.querySelector('.btn-label');
      btn.dataset.label = label ? label.textContent : 'שליחה';
    }

    attachLiveValidation(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (summary) summary.hidden = true;

      // מלכודת בוטים — נראית כהצלחה כדי לא לרמוז על המנגנון
      if (honeypot && honeypot.value.trim() !== '') {
        form.hidden = true;
        if (success) { success.hidden = false; success.focus(); }
        return;
      }

      var result = validateForm(form);
      if (!result.valid) {
        if (summary) {
          summary.textContent = MSG.validationSummary || 'יש להשלים את השדות המסומנים לפני השליחה.';
          summary.hidden = false;
        }
        var target = result.first;
        var focusEl = target;
        var wrap = fieldOf(target) || focusEl;
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try { focusEl.focus({ preventScroll: true }); } catch (err) { focusEl.focus(); }
        return;
      }

      var payload = collect(form);
      delete payload[honeypot ? honeypot.name : '_none'];
      payload.formType = opts.type;
      payload.submittedAt = new Date().toISOString();
      payload.pageUrl = window.location.href;

      setLoading(btn, true);

      sendLead(payload)
        .then(function () {
          form.hidden = true;
          if (success) {
            success.hidden = false;
            success.scrollIntoView({ behavior: 'smooth', block: 'center' });
            success.focus();
          }
          form.reset();
          var nc = $('#notesCount');
          if (nc) nc.textContent = '0';
        })
        .catch(function (err) {
          var isNetwork = err && (err.name === 'AbortError' || err.name === 'TypeError');
          if (summary) {
            summary.textContent = isNetwork
              ? (MSG.networkError || 'לא הצלחנו להתחבר לשרת.')
              : (MSG.genericError || 'אירעה תקלה בשליחת הטופס.');
            summary.hidden = false;
            summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        })
        .then(function () { setLoading(btn, false); });
    });

    if (resetBtn && success) {
      resetBtn.addEventListener('click', function () {
        success.hidden = true;
        form.hidden = false;
        $$('.has-error', form).forEach(function (w) { w.classList.remove('has-error'); });
        $$('.err', form).forEach(function (e2) { e2.hidden = true; });
        if (summary) summary.hidden = true;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        var firstInput = form.querySelector('input:not([type="hidden"]):not([tabindex="-1"])');
        if (firstInput) firstInput.focus();
      });
    }
  }

  /* =======================================================
     אתחול
     ======================================================= */
  function init() {
    initUI();

    initForm({
      type: 'lead',
      form: '#leadForm',
      button: '#leadSubmit',
      success: '#leadSuccess',
      reset: '#leadReset',
      summary: '#leadFormError',
      honeypot: '[name="company"]'
    });

    initForm({
      type: 'contact',
      form: '#contactForm',
      button: '#contactSubmit',
      success: '#contactSuccess',
      reset: '#contactReset',
      summary: '#contactFormError',
      honeypot: '[name="website"]'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
