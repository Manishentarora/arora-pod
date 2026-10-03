# AroraPOD_Backend (2).gs — required changes

The backend file was not available in this repository, so these changes are written
as drop-in code for you to apply. **First save a copy as `AroraPOD_Backend_backup_v2.gs`.**
Names used below (`sendAlert`, `fetchPODs`, `findPodRow`, `extractDriveFileId`,
`ALERT_COLS`, `podSheet2`, `alertData`, `emailedInvNos`, `waSentInvNos`) are the ones
from the fix list. Adjust if your local names differ. No sheet columns are added or
removed. `ALERT_COLS` only gets corrected to match what `sendAlert` already writes.

The frontend (`index.html`) now reads the JSON that `doPost` returns for
`sendAlert` and `verifyPassword`, so both must `return ContentService
.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)`.

---

## Fix 5 — `ALERT_COLS` column order

```js
// … 'Slip Doc URL', 'Packing Photo URLs', 'Email Sent', 'WhatsApp Sent', …
```
Insert `'Packing Photo URLs'` between `'Slip Doc URL'` and `'Email Sent'`.
Email Sent is then index 15 and WhatsApp Sent index 16 (zero-based).

## Fixes 3, 5, 6 — `fetchPODs`

```js
// Fix 5 + 6: correct columns, ignore blank or short invoice numbers
alertData.forEach(function(r) {
  var inv = String(r[INV_IDX] || '').trim();      // existing invoice-no index
  if (inv.length < 4) return;                     // Fix 6: never match '' or junk
  var emailSent = r[15];                          // Email Sent (was wrongly r[14])
  var waSent    = r[16];                          // WhatsApp Sent
  if (emailSent === true || String(emailSent).toLowerCase() === 'yes' || String(emailSent).toLowerCase() === 'true') emailedInvNos.add(inv);
  if (waSent    === true || String(waSent).toLowerCase()    === 'yes' || String(waSent).toLowerCase()    === 'true') waSentInvNos.add(inv);
});

// Fix 3: status mapping when building each pod object
var rawStatus = String(row[STATUS_IDX] || '').trim().toLowerCase();
var status = rawStatus === 'approved'   ? 'approved'
           : rawStatus === 'incomplete' ? 'incomplete'
           : rawStatus === 'alerted'    ? 'Alerted'
           : 'pending';
pod.status    = status;
pod.isAlerted = (status === 'Alerted');   // frontend excludes these from review

// When matching a pod to the alert sets, apply the same ≥4-char guard:
var podInv = String(pod.invoice || '').trim();
pod.alertEmailSent = podInv.length >= 4 && emailedInvNos.has(podInv);
pod.alertWASent    = podInv.length >= 4 && waSentInvNos.has(podInv);
```

## Fixes 1, 2, 4, 8, 14, 15 — `sendAlert`

```js
function sendAlert(payload) {
  var alertId   = String(payload.podId || '').trim();
  var mode      = String(payload.mode || '');
  var isCourier = (mode === 'Courier' || mode === 'Porter' || mode === 'Transport');
  // Fix 2: plain IST date string so Sheets cannot auto-convert it into a UTC Date
  var dispatchDate = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');

  // … existing upload of invoice / slip / packing photos …
  // Fix 15: re-use the existing Drive file when no new invoice image was sent
  var invoiceDocUrl = '';
  var invoiceBlob   = null;
  if (payload.invoiceDocBase64) {
    // existing upload code → sets invoiceDocUrl and invoiceBlob
  } else if (payload.invoicePhotoUrl) {
    try {
      var fid = extractDriveFileId(payload.invoicePhotoUrl);
      if (fid) {
        invoiceBlob   = DriveApp.getFileById(fid).getBlob();   // attach directly, no re-upload
        invoiceDocUrl = payload.invoicePhotoUrl;
      }
    } catch (e) { invoiceDocUrl = 'FAILED'; }
  }

  // Fix 14: build the attachment list only from what actually exists
  var docLines = [];
  if (invoiceDocUrl && invoiceDocUrl !== 'FAILED') docLines.push('• Invoice copy');
  if (slipDocUrl && slipDocUrl !== 'FAILED')       docLines.push('• ' + (mode === 'Transport' ? 'LR copy' : mode === 'Porter' ? 'Porter receipt' : 'Docket slip'));
  if (packPhotoUrls.length > 0)                     docLines.push('• Packing photos (' + packPhotoUrls.length + ')');
  var docketLine = String(payload.docket || '').trim() ? 'Docket / AWB No.: ' + payload.docket + '\n' : '';
  var docsBlock  = docLines.length ? 'Documents attached:\n' + docLines.join('\n') + '\n' : '';
  // … use docketLine and docsBlock in the email body instead of the fixed text …

  // Fix 8: track the real email outcome
  var emailSent = false, errorMsg = null;
  try {
    var attachments = [];
    if (invoiceBlob) attachments.push(invoiceBlob);
    // … push slip blob + packing photo blobs as before …
    GmailApp.sendEmail(payload.email, subject, body, {attachments: attachments /* , htmlBody … */});
    emailSent = true;
  } catch (e) {
    errorMsg = String(e && e.message || e);
  }

  // … existing appendRow to the Alerts sheet (write dispatchDate, Email Sent = emailSent) …

  // Fixes 1 + 4: create/update a POD row ONLY for Courier / Porter / Transport,
  // never for an empty id, and never append twice for the same id.
  if (isCourier && alertId) {
    var podSheet2 = /* existing PODs sheet getter */;
    var existing  = findPodRow(podSheet2, alertId);
    if (existing) {
      // Already created by an earlier Email press → update remarks only
      podSheet2.getRange(existing, REMARKS_COL).setValue('Alert re-sent ' +
        Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy HH:mm') + ' by ' + (payload.sentBy || ''));
    } else {
      // existing appendRow(...) with status 'Alerted' and dispatch date = dispatchDate
    }
  }
  // Own-fleet PODs: no row is created and their status is never touched here.

  return {success: true, emailSent: emailSent, error: errorMsg};
}
```

## Fix 9 — `verifyPassword` (doPost case)

Return a readable result. Do not change the passwords themselves:

```js
case 'verifyPassword':
  return jsonOut({success: true, match: /* existing comparison */});
```

## Action coverage the backend must have

`doPost`: changePassword, deflagSerial, markSerialException, markWASent, ocrImage,
ocrInvoice, replacePhoto, saveReview, sendAlert, submitPOD, updateCustomer,
updatePodDetails, verifyPassword.

`doGet`: fetchCustomers, fetchOCR, fetchPODs, getSerialCompleteness, healthCheck,
lookupContact, ocrImage.
