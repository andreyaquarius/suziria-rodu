/* Google Analytics: public host only, basic consent mode, no advertising. */
(() => {
  'use strict';
  if (window.__suziriaAnalyticsInitialized) return;
  window.__suziriaAnalyticsInitialized = true;
  const ID = 'G-5JJF0VN5GN';
  const HOST = 'suziria.trekerrodu.com.ua';
  const KEY = 'suziria.analytics.consent.v1';
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const denied = {analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'};
  window[`ga-disable-${ID}`] = true;
  // Never send local/admin/GitHub-preview traffic to the production property.
  if (location.protocol !== 'https:' || location.hostname !== HOST || !['/', '/index.html'].includes(location.pathname)) return;
  const panel = document.getElementById('analyticsConsent');
  const settings = document.getElementById('analyticsSettings');
  const accept = document.getElementById('analyticsAccept');
  const decline = document.getElementById('analyticsDecline');
  const status = document.getElementById('analyticsConsentState');
  if (![panel, settings, accept, decline, status].every(Boolean)) return;
  let configured = false;
  let choice = readChoice();

  function readChoice() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && ['granted','denied'].includes(saved.choice) && Number.isFinite(saved.expires) && saved.expires > Date.now() && saved.expires <= Date.now() + MAX_AGE) return saved.choice;
    } catch { /* No storage access means no assumed consent. */ }
    return null;
  }
  function saveChoice(value) {
    try { localStorage.setItem(KEY, JSON.stringify({choice:value, expires:Date.now() + MAX_AGE})); }
    catch { try { localStorage.removeItem(KEY); } catch { /* Session-only choice. */ } }
  }
  function clearCookies() {
    // Delete only this site's prefixed GA cookies, not Tracker Rodu's cookies.
    for (const item of document.cookie.split(';')) {
      const name = item.trim().split('=')[0];
      if (!/^_?suziria_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', `; Domain=${HOST}`]) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain}`;
      }
    }
  }
  function start() {
    window[`ga-disable-${ID}`] = false;
    if (configured) {
      window.gtag('consent', 'update', {...denied, analytics_storage:'granted'});
      return;
    }
    configured = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', denied);
    window.gtag('js', new Date());
    window.gtag('consent', 'update', {...denied, analytics_storage:'granted'});
    const view = ['map','rating','channels','topics','people','videos'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'map';
    let referrer = '';
    try { const url = new URL(document.referrer); if (['http:','https:'].includes(url.protocol)) referrer = url.origin + '/'; } catch { /* No referrer. */ }
    window.gtag('config', ID, {
      allow_google_signals:false,
      allow_ad_personalization_signals:false,
      cookie_domain:HOST,
      cookie_prefix:'suziria',
      cookie_flags:'SameSite=Lax;Secure',
      cookie_expires:MAX_AGE / 1000,
      page_location:`https://${HOST}/#${view}`,
      page_referrer:referrer,
    });
    const script = document.createElement('script');
    script.id = 'suziriaGoogleTag';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
    // A content blocker or unavailable Google must never prevent browsing the site.
    script.onerror = () => { window[`ga-disable-${ID}`] = true; };
    document.head.appendChild(script);
  }
  function stop() {
    window[`ga-disable-${ID}`] = true;
    if (configured) window.gtag('consent', 'update', denied);
    clearCookies();
  }
  function render() {
    status.textContent = choice === 'granted' ? 'Статистику дозволено.' : choice === 'denied' ? 'Статистику вимкнено.' : '';
    settings.hidden = false;
  }
  function show(focus = false) {
    render();
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    if (focus) panel.focus();
  }
  function choose(value) {
    choice = value;
    saveChoice(value);
    if (value === 'granted') start(); else stop();
    render();
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
    settings.focus();
  }
  accept.addEventListener('click', () => choose('granted'));
  decline.addEventListener('click', () => choose('denied'));
  settings.addEventListener('click', () => show(true));
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    choice = readChoice();
    if (choice === 'granted') start(); else stop();
    render();
    panel.hidden = choice !== null;
    settings.setAttribute('aria-expanded', String(!panel.hidden));
  });
  render();
  if (choice === 'granted') start();
  else { stop(); if (!choice) show(); }
})();
