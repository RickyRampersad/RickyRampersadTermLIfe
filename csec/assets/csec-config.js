/* SEA Study Hub — deployment configuration.
 *
 * This is the ONLY file to edit when wiring up the hub. Nothing else needs
 * touching, and upgrading the other assets will never lose these values.
 *
 * ── Sync endpoint ────────────────────────────────────────────────────────────
 * Deploy gs/csec-sync.gs as a Google Apps Script web app (instructions are at
 * the top of that file), then paste its /exec URL below, replacing the
 * placeholder. Leave the placeholder as it is and the hub runs device-local:
 * everything still works, Settings simply says sync is not switched on yet.
 *
 * Check it with: <your /exec URL>?action=ping  →  {"ok":true,...}
 */
window.CSEC_SYNC_URL = 'https://script.google.com/macros/s/AKfycby2sCwm8jodfaygGgzq_HZk0WRJ4Ri2b56cTM7sSOfq2-5UC5oSm5Tsss21H3rs90oC/exec';
