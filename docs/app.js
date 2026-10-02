const $ = (id) => document.getElementById(id);
const data = await fetch('./content.json').then(r => r.json());
const KEY = 'smokefree-profile-v1';
let profile = null;
let actionOffset = 0;
let registration = null;

function save() { localStorage.setItem(KEY, JSON.stringify(profile)); }
function readProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && p.name && Number.isFinite(p.quitAt) && p.quitAt <= Date.now()) return p;
  } catch { /* Corrupt local data should not block onboarding. */ }
  return null;
}
function localInputValue(utcMs) {
  const d = new Date(utcMs - new Date(utcMs).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
function setOnboarding(edit = false) {
  $('onboarding').hidden = false;
  $('dashboard').hidden = true;
  $('welcome-title').innerHTML = edit ? 'הפרטים שלך.<br><span>אפשר לעדכן בכל רגע.</span>' : 'הפסקת לעשן.<br><span>בוא נראה מה הרווחת.</span>';
  if (profile) {
    $('name').value = profile.name;
    $('quit-at').value = localInputValue(profile.quitAt);
    $('nrt').checked = !!profile.nrt;
  } else $('quit-at').value = localInputValue(Date.now());
}
function eligibleEvents() { return data.events.filter(e => !e.condition || !profile.nrt); }
function elapsedMinutes() { return Math.max(0, (Date.now() - profile.quitAt) / 60000); }
function update() {
  if (!profile) return;
  const minutes = elapsedMinutes();
  const totalMinutes = Math.floor(minutes);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  $('timer').innerHTML = `<span>${days}</span><small>ימים</small><span>${String(hours).padStart(2, '0')}</span><small>שעות</small><span>${String(mins).padStart(2, '0')}</span><small>דקות</small>`;
  $('greeting').textContent = `${profile.name}, ממשיכים קדימה`;
  $('hero-subtitle').textContent = days === 0 ? 'כל רגע בלי עשן מצטבר. גם ההתחלה נחשבת.' : `כבר ${days} ${days === 1 ? 'יום' : 'ימים'} בלי סיגריה. בקצב שלך.`;
  const events = eligibleEvents();
  const activeIndex = Math.max(0, events.findLastIndex(e => e.minute <= minutes));
  const active = events[activeIndex];
  const next = events[activeIndex + 1];
  $('stage-count').textContent = `אבן דרך ${activeIndex + 1} מתוך ${events.length}`;
  $('fact-stage').textContent = active.label;
  $('fact-title').textContent = activeIndex === 0 ? 'התחלת רצף בלי עשן' : 'אבן הדרך האחרונה';
  $('fact-copy').textContent = active.claim;
  $('fact-source').href = active.source;
  $('appearance-copy').textContent = minutes < 4320
    ? 'הפסקת העישון עוצרת חשיפה נוספת לעשן ולחומרים שמכתימים שיניים. כתמים קיימים אינם נעלמים בהכרח מעצמם.'
    : 'NHS מתאר שיפור בזרימת הדם לעור בתוך ימים אחדים. מראה העור עשוי להשתפר בהדרגה, בלי מועד אישי מובטח ובלי הבטחה לשינוי באקנה או בקמטים.';
  if (next) {
    const remaining = Math.max(0, Math.ceil(next.minute - minutes));
    $('next-label').textContent = `הבא: ${next.label}`;
    $('next-time').textContent = remaining < 60 ? `בעוד ${remaining} דקות` : `בעוד ${Math.ceil(remaining / 60)} שעות`;
    const previousMinute = active.minute;
    $('progress-fill').style.width = `${Math.min(100, Math.max(0, (minutes - previousMinute) / (next.minute - previousMinute) * 100))}%`;
  } else {
    $('next-label').textContent = 'המסע ממשיך';
    $('next-time').textContent = 'גם אחרי 30 יום';
    $('progress-fill').style.width = '100%';
  }
  const dayIndex = Math.min(29, Math.floor(minutes / 1440));
  $('day-badge').textContent = `יום ${dayIndex + 1}`;
  $('daily-action').textContent = data.dailyActions[(dayIndex + actionOffset) % data.dailyActions.length];
}
function showDashboard() {
  $('onboarding').hidden = true;
  $('dashboard').hidden = false;
  $('frequency').value = profile.frequency || '1';
  $('wake').value = profile.wake || '08:00';
  $('sleep').value = profile.sleep || '22:00';
  update();
  updateNotificationStatus();
}
async function getRegistration() {
  if (!('serviceWorker' in navigator)) throw new Error('הדפדפן לא תומך ב־service worker');
  registration ||= await navigator.serviceWorker.register('./sw.js');
  return registration;
}
function vapidToBytes(key) {
  const padding = '='.repeat((4 - key.length % 4) % 4);
  const raw = atob((key + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function notificationError(error) {
  const message = String(error?.message || '');
  if (/permission|denied|not.allowed/i.test(message)) return 'הדפדפן חסם התראות. בדוק את הרשאת האתר והתקנת האפליקציה.';
  if (/registration|network|push|secure|https/i.test(message)) return 'חיבור ההתראות נכשל. ודא שהאתר פתוח ב־HTTPS ונסה שוב.';
  return 'שמירת ההתראות נכשלה. נסה שוב מאוחר יותר.';
}
async function syncSubscription() {
  const reg = await getRegistration();
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;
  const response = await fetch('/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription, quitAt: profile.quitAt, nrt: profile.nrt, frequency: profile.frequency, wake: profile.wake, sleep: profile.sleep, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }) });
  if (!response.ok) throw new Error('שמירת הגדרות ההתראה נכשלה');
}
async function updateNotificationStatus() {
  if (true) {
    $('notification-status').textContent = 'לא זמינות בגרסת התצוגה';
    $('notify-button').disabled = true;
    return;
  }
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
    $('notification-status').textContent = 'הדפדפן אינו תומך בהתראות רקע';
    $('notify-button').disabled = true;
    return;
  }
  const reg = await getRegistration();
  const active = await reg.pushManager.getSubscription();
  $('notify-button').textContent = active ? 'כיבוי התראות' : 'הפעלת התראות';
  $('notification-status').textContent = active ? 'פעיל' : Notification.permission === 'denied' ? 'נחסם בהגדרות הדפדפן' : 'כבוי';
}

$('profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('name').value.trim();
  const quitAt = new Date($('quit-at').value).getTime();
  if (!name || !Number.isFinite(quitAt) || quitAt > Date.now() || quitAt < Date.UTC(2000, 0, 1)) {
    $('quit-at').setCustomValidity('יש לבחור זמן הפסקה תקין שאינו בעתיד.');
    $('quit-at').reportValidity();
    return;
  }
  $('quit-at').setCustomValidity('');
  profile = { name, quitAt, nrt: $('nrt').checked, frequency: profile?.frequency || '1', wake: profile?.wake || '08:00', sleep: profile?.sleep || '22:00' };
  save();
  showDashboard();
  try { await syncSubscription(); } catch (error) { $('notification-status').textContent = notificationError(error); }
});
$('quit-at').addEventListener('input', () => $('quit-at').setCustomValidity(''));
$('edit-profile').addEventListener('click', () => { setOnboarding(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('new-action').addEventListener('click', () => { actionOffset = (actionOffset + 1) % data.dailyActions.length; update(); });
for (const id of ['frequency', 'wake', 'sleep']) $(id).addEventListener('change', async () => {
  if ($('wake').value === $('sleep').value) { $('notification-status').textContent = 'שעות התחלה וסיום חייבות להיות שונות'; return; }
  profile.frequency = $('frequency').value;
  profile.wake = $('wake').value;
  profile.sleep = $('sleep').value;
  save();
  try { await syncSubscription(); $('notification-status').textContent = 'ההגדרות נשמרו'; } catch (error) { $('notification-status').textContent = notificationError(error); }
});
$('notify-button').addEventListener('click', async () => {
  const button = $('notify-button');
  button.disabled = true;
  try {
    const reg = await getRegistration();
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await fetch('/api/subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: existing }) });
      await existing.unsubscribe();
    } else {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('יש לאשר התראות בהגדרות הדפדפן');
      const { publicKey } = await fetch('/api/vapid-public').then(r => r.json());
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidToBytes(publicKey) });
      await syncSubscription();
    }
    await updateNotificationStatus();
  } catch (error) { $('notification-status').textContent = notificationError(error); }
  finally { button.disabled = false; }
});

profile = readProfile();
if (profile) showDashboard(); else setOnboarding();
setInterval(update, 1000);
