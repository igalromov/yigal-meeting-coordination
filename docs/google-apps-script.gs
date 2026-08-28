/**
 * =========================================================
 *  קליטת לידים → Google Sheets + התראה ב-Gmail
 * =========================================================
 *  קובץ זה אינו חלק מהאתר. הוא מיועד להדבקה ב-
 *  Google Apps Script (script.google.com), ורץ בצד השרת
 *  בחשבון Google שלך בלבד. כך אין צורך בשום מפתח API
 *  בקוד האתר הפומבי.
 *
 *  התקנה מהירה:
 *   1. צור Google Sheet חדש עם לשונית בשם "Leads".
 *   2. תפריט: Extensions → Apps Script. הדבק את הקובץ הזה.
 *   3. עדכן את NOTIFY_EMAIL למטה.
 *   4. Deploy → New deployment → Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   5. העתק את כתובת ה-/exec והדבק אותה ב-
 *      assets/js/config.js תחת leadEndpoint.
 * =========================================================
 */

/** כתובת שאליה תישלח התראה על ליד חדש */
var NOTIFY_EMAIL = 'CHANGE-ME@example.com';

/** שם הלשונית בגיליון */
var SHEET_NAME = 'Leads';

/** סדר העמודות בגיליון (חייב להתאים לשורת הכותרת) */
var COLUMNS = [
  'submittedAt', 'formType', 'fullName', 'phone', 'email', 'ageRange',
  'lastReview', 'activePension', 'studyFund', 'multipleJobs',
  'multipleProducts', 'recentJobChange', 'topics',
  'contactMethod', 'contactTime', 'notes', 'message', 'consent', 'pageUrl'
];

var HEADERS_HE = [
  'תאריך שליחה', 'סוג טופס', 'שם מלא', 'טלפון', 'אימייל', 'טווח גילאים',
  'בדיקה אחרונה', 'קרן פנסיה פעילה', 'קרן השתלמות', 'ריבוי מקומות עבודה',
  'ריבוי מוצרים', 'החלפת עבודה לאחרונה', 'נושאים לבדיקה',
  'אמצעי קשר מועדף', 'זמן חזרה מועדף', 'הערות', 'הודעה', 'אישור יצירת קשר', 'כתובת הדף'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // מלכודת בוטים — מחזירים "הצלחה" בלי לשמור
    if (data.company || data.website) {
      return json({ ok: true });
    }

    if (!data.fullName || !data.phone) {
      return json({ ok: false, error: 'missing required fields' }, 400);
    }

    var sheet = getSheet_();
    var row = COLUMNS.map(function (key) {
      var v = data[key];
      return v === undefined || v === null ? '' : String(v).slice(0, 1000);
    });
    sheet.appendRow(row);

    notify_(data);
    return json({ ok: true });

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server error' }, 500);
  }
}

/** בדיקת חיים לדפדפן */
function doGet() {
  return json({ ok: true, service: 'lead-intake' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS_HE);
    sheet.getRange(1, 1, 1, HEADERS_HE.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notify_(data) {
  if (!NOTIFY_EMAIL || NOTIFY_EMAIL.indexOf('CHANGE-ME') === 0) return;

  var isLead = data.formType === 'lead';
  var subject = (isLead ? 'ליד חדש מהאתר' : 'הודעה חדשה מהאתר') + ' — ' + (data.fullName || '');

  var lines = COLUMNS.map(function (key, i) {
    var v = data[key];
    if (!v) return null;
    return HEADERS_HE[i] + ': ' + v;
  }).filter(Boolean);

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    body: lines.join('\n'),
    replyTo: data.email || undefined
  });
}

function json(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
