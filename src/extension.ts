import * as vscode from 'vscode';
import * as fs   from 'fs';
import * as path from 'path';
import * as PM  from './promptMemory';
import * as Nav from './navigator';
import * as CT  from './changeTracker';

const API_BASE      = 'https://tursiops-web.vercel.app';
const TOKEN_KEY     = 'tursiops.authToken';
const EMAIL_KEY     = 'tursiops.authEmail';
const GEMINI_KEY    = 'tursiops.geminiKey';

// ---------------------------------------------------------------------------
// Shared SVG — user's 309752.svg with #2596D9→#3B82F6 gradient
// ---------------------------------------------------------------------------
const DOLPHIN_SVG = `
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1280 1280" preserveAspectRatio="xMidYMid meet"
  style="display:block;">
  <circle cx="640" cy="640" r="640" fill="#071220"/>
  <defs>
    <radialGradient id="dpg" cx="42%" cy="38%" r="58%">
      <stop offset="0%"   stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#2596D9"/>
    </radialGradient>
  </defs>
  <g transform="translate(0,1280) scale(0.1,-0.1)" fill="url(#dpg)" stroke="none">
    <path d="M3695 12794 c-366 -21 -570 -48 -805 -105 -679 -165 -1153 -380
-1529 -694 -229 -191 -411 -434 -548 -730 -77 -166 -102 -257 -118 -427 -27
-280 -106 -447 -343 -720 -170 -196 -255 -333 -306 -495 -62 -197 -58 -464 8
-592 60 -115 276 -252 467 -296 246 -55 520 -23 1071 129 392 108 652 160 944
191 177 19 499 21 604 5 83 -13 331 -68 338 -75 2 -2 8 -62 13 -132 42 -611
52 -707 95 -912 94 -459 263 -697 524 -741 165 -28 316 54 493 269 36 43 127
168 202 277 193 280 288 395 314 379 21 -12 53 -125 81 -287 48 -270 100 -430
211 -652 294 -588 841 -1042 1401 -1163 62 -14 127 -18 263 -18 158 0 189 3
250 22 129 41 211 114 256 231 17 44 23 84 27 172 5 147 -16 252 -103 520 -98
304 -103 360 -29 360 93 0 443 -218 721 -448 344 -285 686 -668 950 -1062 260
-390 491 -892 674 -1470 130 -408 171 -657 139 -831 -23 -124 -51 -144 -250
-184 -170 -35 -287 -73 -418 -135 -412 -197 -712 -544 -817 -946 -67 -256 -49
-501 47 -641 58 -85 137 -126 243 -125 90 0 174 28 290 96 153 90 176 93 308
37 120 -52 200 -65 345 -57 382 19 375 19 442 2 35 -9 91 -32 125 -50 88 -49
219 -91 426 -136 335 -72 500 -134 683 -255 239 -159 364 -348 432 -653 56
-246 125 -360 254 -421 47 -22 68 -26 150 -26 116 1 173 23 240 94 84 89 205
333 260 525 109 378 103 802 -17 1164 -93 281 -289 571 -613 906 -220 227
-426 396 -777 636 -101 68 -183 130 -183 138 0 8 15 121 34 251 92 632 122
1101 113 1776 -9 647 -55 1168 -157 1779 -133 793 -324 1467 -620 2185 -74
182 -112 333 -114 456 -2 203 29 227 324 260 259 29 420 59 481 91 71 36 90
180 43 340 -85 296 -341 658 -614 869 -285 220 -857 469 -1272 554 -190 39
-313 46 -813 46 -393 -1 -534 -5 -779 -23 l-298 -22 -452 170 c-453 169 -742
265 -1086 360 -464 128 -755 178 -1250 216 -183 14 -843 26 -975 18z m920
-344 c528 -21 906 -67 1255 -151 1303 -315 2407 -1008 3224 -2027 372 -465
703 -1026 900 -1527 111 -282 156 -367 156 -298 0 89 -149 561 -264 837 -298
712 -729 1373 -1203 1843 -145 144 -262 242 -453 379 -144 103 -250 198 -250
225 0 30 61 41 270 46 482 13 1341 -87 1540 -179 l45 -21 -50 -9 c-30 -5 -206
-4 -450 3 -440 13 -741 9 -792 -11 -18 -6 -33 -14 -33 -16 0 -39 161 -197 278
-274 140 -92 241 -109 642 -110 540 -1 758 -34 994 -152 253 -126 466 -325
454 -424 -12 -102 -281 -110 -641 -18 -198 50 -310 43 -378 -25 -45 -45 -62
-100 -61 -201 1 -155 43 -301 219 -765 197 -519 415 -1128 522 -1459 41 -126
114 -411 207 -815 172 -747 244 -1366 244 -2103 0 -470 -25 -797 -91 -1198
-49 -301 -107 -523 -233 -899 -53 -157 -94 -286 -92 -288 2 -2 84 -24 182 -48
571 -139 935 -332 1221 -648 83 -93 182 -240 231 -348 117 -251 192 -613 192
-918 0 -175 -17 -283 -64 -416 -67 -187 -142 -233 -195 -121 -10 23 -36 86
-56 141 -147 398 -407 691 -784 884 -112 57 -237 105 -437 167 -173 54 -279
97 -382 158 -152 90 -227 177 -239 277 -7 69 -18 89 -47 89 -34 0 -89 -40
-196 -144 -137 -133 -153 -141 -275 -141 -55 0 -179 10 -275 22 -96 13 -266
27 -376 32 -310 15 -320 23 -318 271 1 103 7 178 18 223 61 258 286 458 656
581 165 55 330 86 645 121 132 15 241 28 242 29 3 2 -1 52 -33 401 -15 172
-53 442 -80 570 -24 112 -43 181 -90 327 -59 184 -59 247 1 156 76 -114 199
-365 324 -660 35 -82 69 -148 76 -148 30 0 42 197 51 850 9 735 -2 834 -181
1495 -341 1260 -1126 2364 -2385 3354 -215 170 -350 255 -350 222 0 -24 77
-120 248 -309 248 -275 467 -573 605 -823 156 -284 162 -296 136 -273 -13 12
-113 100 -221 196 -260 231 -341 299 -475 399 -239 179 -541 352 -706 404 -90
29 -214 43 -242 28 -19 -11 -14 -16 112 -113 137 -105 148 -252 41 -579 -76
-234 -105 -492 -94 -826 8 -256 21 -356 96 -726 69 -341 79 -453 46 -502 -10
-15 -51 -43 -92 -63 -65 -33 -79 -36 -136 -32 -99 6 -165 43 -284 162 -230
231 -449 657 -662 1291 -75 222 -159 524 -262 940 -169 680 -266 916 -404 987
-36 19 -39 22 -21 29 29 11 107 11 205 -1 112 -13 166 -25 277 -62 127 -41
140 -36 77 27 -63 63 -169 123 -307 175 -337 127 -728 199 -1017 186 -296 -13
-640 -64 -640 -95 0 -5 34 -14 75 -20 172 -25 616 -227 790 -359 49 -37 115
-114 115 -134 0 -22 -139 1 -410 65 -571 137 -746 161 -1100 154 -207 -4 -268
-8 -392 -31 -340 -61 -694 -173 -1228 -391 -549 -223 -660 -262 -889 -305
-158 -31 -324 -26 -396 10 -27 14 -51 30 -52 36 -7 23 74 42 317 74 339 45
617 151 925 354 277 182 585 472 585 549 0 10 -15 34 -34 53 -29 29 -39 34
-63 28 -41 -10 -123 -74 -187 -146 -228 -258 -630 -515 -995 -635 -123 -40
-318 -83 -376 -83 -79 1 -185 74 -247 169 -35 55 -36 106 -7 193 77 223 232
413 444 540 75 45 140 71 247 98 97 25 137 46 145 78 7 29 -12 51 -65 74 -77
34 -94 91 -63 212 67 258 250 532 590 880 209 214 269 282 258 293 -11 10
-126 -38 -208 -87 -152 -92 -320 -252 -451 -432 -73 -99 -115 -170 -187 -319
-61 -126 -99 -177 -122 -164 -35 22 30 273 113 439 264 527 850 917 1683 1121
299 73 524 105 885 124 222 12 705 12 985 1z m475 -2774 c84 -56 189 -150 257
-229 96 -109 160 -275 194 -502 88 -582 266 -1153 530 -1704 106 -221 179
-352 331 -588 76 -119 158 -274 158 -300 0 -22 -44 -15 -91 15 -190 122 -467
401 -605 608 -109 167 -225 424 -299 669 -56 184 -88 328 -165 730 -103 541
-128 654 -181 816 -45 140 -61 176 -178 403 -28 55 -51 105 -51 113 0 24 34
14 100 -31z m-1230 -180 c550 -41 714 -68 879 -148 90 -43 115 -61 190 -136
47 -48 101 -113 120 -145 50 -85 97 -234 121 -382 11 -71 23 -143 26 -158 5
-25 -15 -14 -223 126 -261 177 -372 242 -531 315 -200 92 -407 152 -652 191
-252 40 -347 45 -995 46 -577 1 -715 6 -715 24 0 34 654 257 825 281 87 13
715 3 955 -14z m3685 -1145 c113 -51 431 -282 640 -465 378 -330 745 -745 916
-1033 149 -252 407 -856 463 -1083 26 -104 27 -110 15 -110 -21 0 -166 166
-514 591 -124 150 -474 511 -659 678 -344 311 -603 501 -826 608 -218 105
-215 98 -215 453 0 268 7 322 46 361 24 24 81 25 134 0z"/>
  </g>
</svg>`.trim();

// ---------------------------------------------------------------------------
// Shared CSS block reused across all views
// ---------------------------------------------------------------------------
const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);
    font-size: 13px;
    background: #060d1a;
    color: #cfe2ff;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px 28px;
  }
  .logo-wrap {
    display: flex; flex-direction: column; align-items: center;
    gap: 8px; margin-bottom: 28px;
  }
  .logo-icon { width: 60px; height: 60px; }
  .logo-icon svg { width: 60px; height: 60px; }
  .logo-name { font-size: 19px; font-weight: 700; letter-spacing: 0.04em; color: #fff; }
  .logo-tagline { font-size: 11px; color: #4b7ab8; letter-spacing: 0.03em; text-align: center; }

  .card {
    width: 100%; max-width: 300px;
    background: #0c1a2e; border: 1px solid #1a3050;
    border-radius: 14px; padding: 24px 20px 20px;
  }
  .card-title { font-size: 14px; font-weight: 600; color: #93c5fd; text-align: center; margin-bottom: 4px; }
  .card-sub   { font-size: 11px; color: #3d6494; text-align: center; margin-bottom: 20px; line-height: 1.5; }

  .field { margin-bottom: 13px; }
  label  { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase;
           letter-spacing: 0.07em; color: #3d6494; margin-bottom: 5px; }
  input  {
    width: 100%; background: #071220; border: 1px solid #1a3050;
    border-radius: 7px; padding: 9px 11px; font-size: 13px;
    color: #cfe2ff; outline: none; font-family: inherit;
    transition: border-color 0.15s;
  }
  input::placeholder { color: #1d3a5c; }
  input:focus { border-color: #2596D9; }

  .btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 10px 14px; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    letter-spacing: 0.02em; transition: filter 0.15s, transform 0.1s;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .btn-primary   { background: #2596D9; color: #fff; }
  .btn-primary:hover:not(:disabled)   { filter: brightness(1.15); }
  .btn-secondary { background: #071220; color: #93c5fd; border: 1px solid #1a3050; }
  .btn-secondary:hover:not(:disabled) { border-color: #2596D9; color: #bfdbfe; }

  .divider { display: flex; align-items: center; gap: 10px;
             margin: 14px 0; color: #1a3050; font-size: 11px; }
  .divider::before, .divider::after { content:''; flex:1; height:1px; background:#1a3050; }

  .error-box {
    display: none; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    border-radius: 7px; padding: 8px 11px; font-size: 11.5px; color: #f87171;
    margin-bottom: 13px; line-height: 1.4;
  }
  .error-box.visible { display: block; }

  .note { margin-top: 16px; font-size: 10.5px; color: #2d4f72; text-align: center; line-height: 1.55; }
  .note b { color: #2596D9; font-weight: 500; }

  /* eye toggle inside password field */
  .input-wrap { position: relative; }
  .input-wrap input { padding-right: 36px; }
  .eye-btn {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #3d6494; padding: 2px;
    display: flex; align-items: center;
  }
  .eye-btn:hover { color: #93c5fd; }
`;

// ---------------------------------------------------------------------------
// Sidebar panel
// ---------------------------------------------------------------------------
class TursiopsViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'tursiops.panel';
  private _view?: vscode.WebviewView;

  constructor(private readonly _ctx: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._ctx.extensionUri],
    };
    this._render();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case 'open-signin':
          await vscode.env.openExternal(vscode.Uri.parse(`${API_BASE}?redirect=vscode&action=signin&ext=Conquestcore.tursiops-ai`));
          break;
        case 'open-signup':
          await vscode.env.openExternal(vscode.Uri.parse(`${API_BASE}?redirect=vscode&action=signup&ext=Conquestcore.tursiops-ai`));
          break;
        case 'save-gemini-key':
          await this._handleSaveGeminiKey(msg.key);
          break;
        case 'change-key':
          await this._ctx.globalState.update(GEMINI_KEY, undefined);
          this._render();
          break;
        case 'signout':
          await this._handleSignOut();
          break;
        // ── Prompt Memory ──────────────────────────────────────────────
        case 'pm-add': {
          const geminiKey = this._ctx.globalState.get<string>(GEMINI_KEY) ?? '';
          if (!msg.prompt?.trim()) { break; }
          try {
            this._view?.webview.postMessage({ command: 'pm-loading', mode: msg.mode });
            const entry = await PM.addPrompt(msg.mode, msg.prompt, geminiKey);
            PM.generateContextSummary();
            this._view?.webview.postMessage({ command: 'pm-added', mode: msg.mode, entry });
            // Capture workspace diff for MiniGit after every prompt, then refresh panel
            CT.captureChange(entry.refined, geminiKey)
              .then(() => {
                const changes = CT.loadAllChanges();
                this._view?.webview.postMessage({ command: 'mg-data', changes });
              })
              .catch(() => {/* non-fatal */});
          } catch (e) {
            this._view?.webview.postMessage({ command: 'pm-error', message: String(e) });
          }
          break;
        }
        case 'pm-load': {
          const remEntries = PM.loadEntries('remember');
          const frgEntries = PM.loadEntries('forget');
          this._view?.webview.postMessage({ command: 'pm-data', remember: remEntries, forget: frgEntries });
          break;
        }
        case 'pm-edit': {
          PM.updateEntry(msg.mode, msg.index, msg.refined);
          PM.generateContextSummary();
          this._view?.webview.postMessage({ command: 'pm-edit-done', mode: msg.mode, index: msg.index, refined: msg.refined });
          break;
        }
        case 'open-file': {
          const filePath = msg.mode === 'remember' ? PM.rememberFile() : PM.forgetFile();
          if (filePath) {
            const uri = vscode.Uri.file(filePath);
            await vscode.window.showTextDocument(uri, { preview: false });
          }
          break;
        }
        // ── Navigator ──────────────────────────────────────────────────
        case 'nav-search': {
          const geminiKey = this._ctx.globalState.get<string>(GEMINI_KEY) ?? '';
          if (!msg.query?.trim()) { break; }
          try {
            const inventory = await Nav.buildInventory();
            const results   = await Nav.searchWithGemini(msg.query, inventory, geminiKey);
            this._view?.webview.postMessage({ command: 'nav-results', results });
          } catch (e) {
            this._view?.webview.postMessage({ command: 'nav-error', message: String(e) });
          }
          break;
        }
        case 'nav-open': {
          await Nav.openFile(msg.path);
          break;
        }
        // ── Change Summary (fn3) ───────────────────────────────────────
        case 'cs-load-commits': {
          const commits = CT.gitCommitList();
          this._view?.webview.postMessage({ command: 'cs-commits', commits });
          break;
        }
        case 'cs-summarise': {
          const geminiKey = this._ctx.globalState.get<string>(GEMINI_KEY) ?? '';
          try {
            this._view?.webview.postMessage({ command: 'cs-loading' });
            const summary = await CT.summariseBetweenCommits(msg.hashA, msg.hashB, geminiKey);
            this._view?.webview.postMessage({ command: 'cs-result', summary });
          } catch (e) {
            this._view?.webview.postMessage({ command: 'cs-error', message: String(e) });
          }
          break;
        }
        // ── MiniGit (fn4) ──────────────────────────────────────────────
        case 'mg-load': {
          const changes = CT.loadAllChanges();
          this._view?.webview.postMessage({ command: 'mg-data', changes });
          break;
        }
        case 'mg-open-file': {
          const dir = CT.changesDir();
          if (dir) {
            const fp = path.join(dir, `change_${msg.index}.md`);
            if (fs.existsSync(fp)) {
              await vscode.window.showTextDocument(vscode.Uri.file(fp), { preview: false });
            }
          }
          break;
        }
      }
    });
  }

  /** Called by URI handler after browser auth */
  async applyToken(token: string, email: string): Promise<void> {
    await this._ctx.globalState.update(TOKEN_KEY, token);
    await this._ctx.globalState.update(EMAIL_KEY, email);
    // Check if Gemini key is stored in DB for this user
    await this._fetchAndCacheGeminiKey(token);
    this._render();
    vscode.window.showInformationMessage(`Tursiops: signed in as ${email}`);
  }

  // ---------------------------------------------------------------------------
  // Fetch the stored Gemini key from the backend (if any)
  // ---------------------------------------------------------------------------
  private async _fetchAndCacheGeminiKey(token: string): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/api/user/gemini-key`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { geminiKey?: string };
        if (data.geminiKey) {
          await this._ctx.globalState.update(GEMINI_KEY, data.geminiKey);
        }
      }
    } catch {
      // Network error — not fatal, user can enter key manually
    }
  }

  // ---------------------------------------------------------------------------
  // Validate key with Gemini API, then save to backend + local state
  // ---------------------------------------------------------------------------
  private async _handleSaveGeminiKey(key: string): Promise<void> {
    if (!this._view) { return; }

    // 1. Validate the key with a minimal Gemini API call
    try {
      const testRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      );
      if (!testRes.ok) {
        this._view.webview.postMessage({ command: 'gemini-error', message: 'Invalid API key. Please check and try again.' });
        return;
      }
    } catch {
      this._view.webview.postMessage({ command: 'gemini-error', message: 'Could not reach Google API. Check your connection.' });
      return;
    }

    // 2. Save to backend DB
    const token = this._ctx.globalState.get<string>(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${API_BASE}/api/user/gemini-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ geminiKey: key }),
        });
      } catch {
        // Non-fatal — key still cached locally
      }
    }

    // 3. Cache locally and advance to main screen
    await this._ctx.globalState.update(GEMINI_KEY, key);
    this._render();
    vscode.window.showInformationMessage('Tursiops: Gemini key saved successfully.');
  }

  private _render(): void {
    if (!this._view) { return; }
    const token     = this._ctx.globalState.get<string>(TOKEN_KEY);
    const email     = this._ctx.globalState.get<string>(EMAIL_KEY) ?? '';
    const geminiKey = this._ctx.globalState.get<string>(GEMINI_KEY);

    if (!token) {
      this._view.webview.html = getSignInHtml();
    } else if (!geminiKey) {
      this._view.webview.html = getGeminiKeyHtml(email);
    } else {
      this._view.webview.html = getMainHtml(email, geminiKey);
    }
  }

  private async _handleSignOut(): Promise<void> {
    await this._ctx.globalState.update(TOKEN_KEY, undefined);
    await this._ctx.globalState.update(EMAIL_KEY, undefined);
    await this._ctx.globalState.update(GEMINI_KEY, undefined);
    this._render();
  }
}

// ---------------------------------------------------------------------------
// SCREEN 1 — Sign In / Sign Up
// ---------------------------------------------------------------------------
function getSignInHtml(): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Tursiops</title>
  <style nonce="${nonce}">${BASE_CSS}</style>
</head><body>
  <div class="logo-wrap">
    <div class="logo-icon">${DOLPHIN_SVG}</div>
    <span class="logo-name">Tursiops</span>
    <span class="logo-tagline">Project-aware memory &amp; context</span>
  </div>
  <div class="card">
    <div class="card-title">Welcome</div>
    <div class="card-sub">Sign in to unlock file memory and AI context.</div>
    <button class="btn btn-primary" id="signin-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
        <polyline points="10 17 15 12 10 7"/>
        <line x1="15" y1="12" x2="3" y2="12"/>
      </svg>
      Sign In
    </button>
    <div class="divider">or</div>
    <button class="btn btn-secondary" id="signup-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
      Create Account
    </button>
    <div class="note">After signing in on the web,<br/>click <b>"Open in VS Code"</b> to return here.</div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('signin-btn').onclick = () => vscode.postMessage({ command: 'open-signin' });
    document.getElementById('signup-btn').onclick = () => vscode.postMessage({ command: 'open-signup' });
  </script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// SCREEN 2 — Gemini API Key input
// ---------------------------------------------------------------------------
function getGeminiKeyHtml(email: string): string {
  const nonce   = getNonce();
  const initial = email ? email[0].toUpperCase() : 'T';
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src https://generativelanguage.googleapis.com ${API_BASE};"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Tursiops — Gemini Key</title>
  <style nonce="${nonce}">
    ${BASE_CSS}
    /* profile strip at top */
    .profile-strip {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 12px; background: #0c1a2e; border: 1px solid #1a3050;
      border-radius: 8px; margin-bottom: 20px; width: 100%; max-width: 300px;
    }
    .avatar {
      width: 28px; height: 28px; flex-shrink: 0;
      background: #2596D9; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12px; color: #fff;
    }
    .profile-email {
      flex: 1; min-width: 0; font-size: 11px; color: #93c5fd;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    /* gemini badge */
    .gemini-badge {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; background: rgba(37,150,217,0.08);
      border: 1px solid rgba(37,150,217,0.2); border-radius: 8px;
      margin-bottom: 18px; font-size: 11px; color: #4b7ab8;
      line-height: 1.5;
    }
    .gemini-badge svg { flex-shrink: 0; color: #2596D9; }
    /* key input hints */
    .hint {
      font-size: 10px; color: #1d3a5c; margin-top: 5px; line-height: 1.4;
    }
    .get-key-link {
      display: block; text-align: center; font-size: 11px;
      color: #2596D9; margin-top: 10px; cursor: pointer;
      text-decoration: none;
    }
    .get-key-link:hover { color: #3B82F6; text-decoration: underline; }
  </style>
</head><body>
  <div class="profile-strip">
    <div class="avatar">${escapeHtml(initial)}</div>
    <span class="profile-email">${escapeHtml(email)}</span>
  </div>

  <div class="card">
    <div class="card-title">Connect Gemini</div>
    <div class="card-sub">Tursiops uses Google Gemini to understand your code context.</div>

    <div class="gemini-badge">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      Your key is validated locally and stored securely in your account.
    </div>

    <div class="error-box" id="error-box"></div>

    <div class="field">
      <label for="api-key">Gemini API Key</label>
      <div class="input-wrap">
        <input type="password" id="api-key" placeholder="Paste your Gemini API key..." autocomplete="off" spellcheck="false"/>
        <button class="eye-btn" id="eye-btn" title="Show/hide key">
          <svg id="eye-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
      <div class="hint">Get yours free at aistudio.google.com</div>
    </div>

    <button class="btn btn-primary" id="save-btn" style="margin-top:4px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Validate &amp; Save Key
    </button>

    <a class="get-key-link" id="get-key-link">Get a free key at aistudio.google.com →</a>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const input  = document.getElementById('api-key');
    const saveBtn = document.getElementById('save-btn');
    const errorBox = document.getElementById('error-box');
    const eyeBtn = document.getElementById('eye-btn');

    document.getElementById('get-key-link').onclick = () =>
      vscode.postMessage({ command: 'open-signin' }); // reuse open-external via a no-op; handled below

    // Show/hide key
    eyeBtn.onclick = () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eyeBtn.title = show ? 'Hide key' : 'Show key';
    };

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.classList.add('visible');
    }
    function clearError() {
      errorBox.textContent = '';
      errorBox.classList.remove('visible');
    }

    saveBtn.onclick = () => {
      clearError();
      const key = input.value.trim();
      if (!key) { showError('Please enter your Gemini API key.'); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Validating…';
      vscode.postMessage({ command: 'save-gemini-key', key });
    };

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.command === 'gemini-error') {
        showError(msg.message);
        saveBtn.disabled = false;
        saveBtn.innerHTML = \`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Validate &amp; Save Key\`;
      }
    });
  </script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// SCREEN 3 — Main dashboard
// ---------------------------------------------------------------------------
function getMainHtml(email: string, geminiKey: string): string {
  const nonce     = getNonce();
  const initial   = email ? email[0].toUpperCase() : 'T';
  const maskedKey = geminiKey.slice(0, 6) + '••••••••••••' + geminiKey.slice(-4);

  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Tursiops</title>
  <style nonce="${nonce}">
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);
      font-size: 13px; background: #060d1a; color: #cfe2ff;
      display: flex; flex-direction: column; height: 100vh; overflow: hidden;
    }

    /* ── Top header ───────────────────────────────── */
    .header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px 8px;
      border-bottom: 1px solid #0e2040;
      flex-shrink: 0;
    }
    .header-logo { width: 22px; height: 22px; flex-shrink: 0; }
    .header-logo svg { width: 22px; height: 22px; }
    .header-title { font-size: 13px; font-weight: 700; color: #fff; letter-spacing: 0.03em; flex: 1; }
    .header-avatar {
      width: 24px; height: 24px; background: #2596D9; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
      cursor: pointer; position: relative;
    }
    .header-avatar:hover .avatar-menu { display: block; }
    .avatar-menu {
      display: none; position: absolute; top: 28px; right: 0; z-index: 99;
      background: #0c1a2e; border: 1px solid #1a3050; border-radius: 8px;
      padding: 4px; min-width: 140px;
    }
    .avatar-menu button {
      display: block; width: 100%; text-align: left;
      padding: 7px 10px; font-size: 11.5px; font-family: inherit;
      background: none; border: none; color: #cfe2ff; cursor: pointer;
      border-radius: 5px; transition: background 0.1s;
    }
    .avatar-menu button:hover { background: #1a3050; }
    .avatar-menu .danger { color: #f87171; }
    .avatar-menu .danger:hover { background: rgba(239,68,68,0.1); }
    .avatar-menu .divider-line { height: 1px; background: #1a3050; margin: 3px 0; }

    /* ── Function selector ────────────────────────── */
    .fn-selector {
      padding: 8px 14px 0;
      flex-shrink: 0;
    }
    .fn-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.09em; color: #1d3a5c; margin-bottom: 5px; }
    .fn-select {
      width: 100%; padding: 8px 10px;
      background: #0c1a2e; border: 1px solid #1a3050; border-radius: 8px;
      color: #93c5fd; font-size: 12px; font-family: inherit;
      outline: none; cursor: pointer; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234b7ab8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 10px center;
      padding-right: 28px;
    }
    .fn-select:focus { border-color: #2596D9; }

    /* ── Panel container ──────────────────────────── */
    .panel-wrap {
      flex: 1; overflow-y: auto; padding: 12px 14px 16px;
      scrollbar-width: thin; scrollbar-color: #1a3050 transparent;
    }
    .panel { display: none; }
    .panel.active { display: block; }

    /* ── Prompt Memory panel ──────────────────────── */
    .pm-toggle {
      display: flex; background: #0c1a2e; border: 1px solid #1a3050;
      border-radius: 8px; padding: 3px; margin-bottom: 14px;
    }
    .pm-toggle-btn {
      flex: 1; padding: 7px 6px; font-size: 11.5px; font-weight: 600;
      font-family: inherit; border: none; border-radius: 6px;
      cursor: pointer; transition: background 0.15s, color 0.15s;
      background: none; color: #3d6494;
    }
    .pm-toggle-btn.active { background: #2596D9; color: #fff; }

    .pm-input-area {
      position: relative; margin-bottom: 10px;
    }
    .pm-textarea {
      width: 100%; min-height: 80px; max-height: 160px;
      background: #071220; border: 1px solid #1a3050; border-radius: 8px;
      padding: 10px 12px; font-size: 12px; color: #cfe2ff;
      font-family: inherit; resize: vertical; outline: none;
      transition: border-color 0.15s; line-height: 1.5;
    }
    .pm-textarea:focus { border-color: #2596D9; }
    .pm-textarea::placeholder { color: #1d3a5c; }

    .pm-submit {
      width: 100%; padding: 9px; margin-bottom: 16px;
      background: #2596D9; color: #fff; font-size: 12px; font-weight: 600;
      border: none; border-radius: 7px; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: filter 0.15s;
    }
    .pm-submit:hover:not(:disabled) { filter: brightness(1.12); }
    .pm-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    /* loading spinner */
    .spinner {
      width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Timeline ─────────────────────────────────── */
    .timeline-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }
    .tl-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.09em; color: #1d3a5c; }
    .tl-open-file {
      font-size: 10px; color: #2596D9; background: none; border: none;
      cursor: pointer; font-family: inherit; padding: 2px 4px;
      border-radius: 4px; transition: color 0.15s;
    }
    .tl-open-file:hover { color: #3B82F6; }

    .timeline { position: relative; padding-left: 18px; }
    .timeline::before {
      content: ''; position: absolute; left: 6px; top: 6px;
      bottom: 6px; width: 1px; background: #1a3050;
    }
    .tl-entry {
      position: relative; margin-bottom: 12px;
      background: #0c1a2e; border: 1px solid #1a3050;
      border-radius: 8px; padding: 10px 12px;
      transition: border-color 0.15s;
    }
    .tl-entry:hover { border-color: #2596D9; }
    .tl-dot {
      position: absolute; left: -15px; top: 13px;
      width: 8px; height: 8px; border-radius: 50%;
      background: #2596D9; border: 1.5px solid #060d1a;
    }
    .tl-meta {
      display: flex; align-items: center; gap: 6px;
      margin-bottom: 6px; flex-wrap: wrap;
    }
    .tl-num { font-size: 10px; font-weight: 700; color: #2596D9; }
    .tl-time { font-size: 10px; color: #1d3a5c; }
    .tl-commit {
      font-size: 9.5px; color: #1d3a5c; font-family: monospace;
      background: #071220; padding: 1px 5px; border-radius: 3px;
    }
    .tl-branch {
      font-size: 9.5px; color: #3d6494;
      background: rgba(37,150,217,0.08); padding: 1px 5px; border-radius: 3px;
    }

    .tl-section-label {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; margin-bottom: 3px; margin-top: 6px;
    }
    .tl-section-label.original { color: #1d3a5c; }
    .tl-section-label.refined  { color: #2596D9; }

    .tl-text {
      font-size: 11.5px; color: #7aabce; line-height: 1.5;
    }
    .tl-text.original { color: #3d6494; font-style: italic; }

    .tl-refined-wrap { position: relative; }
    .tl-refined-input {
      width: 100%; background: transparent; border: none; border-bottom: 1px solid transparent;
      color: #7aabce; font-size: 11.5px; font-family: inherit; line-height: 1.5;
      padding: 2px 24px 2px 0; resize: none; outline: none;
      transition: border-color 0.15s; overflow: hidden;
    }
    .tl-refined-input:focus { border-bottom-color: #2596D9; background: rgba(37,150,217,0.04); border-radius: 4px; }
    .tl-save-btn {
      position: absolute; right: 0; bottom: 2px;
      font-size: 9.5px; color: #2596D9; background: none; border: none;
      cursor: pointer; font-family: inherit; opacity: 0; transition: opacity 0.15s;
      padding: 2px 4px;
    }
    .tl-refined-input:focus ~ .tl-save-btn,
    .tl-save-btn:focus { opacity: 1; }

    .tl-empty {
      text-align: center; padding: 24px 0; color: #1d3a5c;
      font-size: 11.5px; line-height: 1.7;
    }

    /* ── Navigator panel ──────────────────────────── */
    .nav-input-row {
      display: flex; gap: 7px; margin-bottom: 14px;
    }
    .nav-input {
      flex: 1; background: #071220; border: 1px solid #1a3050;
      border-radius: 8px; padding: 9px 12px; font-size: 12px;
      color: #cfe2ff; font-family: inherit; outline: none;
      transition: border-color 0.15s;
    }
    .nav-input:focus { border-color: #2596D9; }
    .nav-input::placeholder { color: #1d3a5c; }
    .nav-search-btn {
      padding: 9px 14px; background: #2596D9; color: #fff;
      border: none; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: filter 0.15s;
      display: flex; align-items: center; gap: 6px; white-space: nowrap;
    }
    .nav-search-btn:hover:not(:disabled) { filter: brightness(1.12); }
    .nav-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .nav-results { margin-top: 2px; }
    .nav-result {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 12px; background: #0c1a2e; border: 1px solid #1a3050;
      border-radius: 8px; margin-bottom: 8px; cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .nav-result:hover { border-color: #2596D9; background: #0e1e35; }
    .nav-result-icon { color: #2596D9; flex-shrink: 0; margin-top: 1px; }
    .nav-result-body { flex: 1; min-width: 0; }
    .nav-result-path {
      font-size: 11.5px; font-weight: 600; color: #bfdbfe;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    .nav-result-reason { font-size: 10.5px; color: #3d6494; line-height: 1.4; }
    .nav-result-open {
      font-size: 10px; color: #2596D9; background: none; border: none;
      cursor: pointer; font-family: inherit; flex-shrink: 0;
      padding: 2px 6px; border-radius: 4px; transition: background 0.15s;
      align-self: center;
    }
    .nav-result-open:hover { background: rgba(37,150,217,0.15); }

    .nav-empty {
      text-align: center; padding: 28px 0; color: #1d3a5c;
      font-size: 11.5px; line-height: 1.7;
    }
    .nav-empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }

    /* ── Change Summary panel ─────────────────────── */
    .cs-row {
      display: flex; gap: 8px; margin-bottom: 10px;
    }
    .cs-field { flex: 1; min-width: 0; }
    .cs-label {
      display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #1d3a5c; margin-bottom: 4px;
    }
    .cs-select {
      width: 100%; background: #071220; border: 1px solid #1a3050;
      border-radius: 7px; padding: 7px 8px; font-size: 11px; color: #93c5fd;
      font-family: inherit; outline: none; cursor: pointer;
      appearance: none;
    }
    .cs-select:focus { border-color: #2596D9; }
    .cs-btn {
      width: 100%; padding: 9px; margin-bottom: 12px;
      background: #2596D9; color: #fff; font-size: 12px; font-weight: 600;
      border: none; border-radius: 7px; cursor: pointer; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: filter 0.15s;
    }
    .cs-btn:hover:not(:disabled) { filter: brightness(1.12); }
    .cs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .cs-result-wrap {
      background: #0c1a2e; border: 1px solid #1a3050; border-radius: 8px;
      padding: 12px 14px; margin-bottom: 10px;
    }
    .cs-result-label {
      font-size: 9.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #2596D9; margin-bottom: 8px;
    }
    .cs-result-body {
      font-size: 11.5px; color: #7aabce; line-height: 1.7; white-space: pre-wrap;
    }
    .cs-result-body strong { color: #bfdbfe; }
    .cs-empty {
      text-align: center; padding: 24px 0; color: #1d3a5c;
      font-size: 11.5px; line-height: 1.7;
    }
    .cs-empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }

    /* ── MiniGit panel ────────────────────────────── */
    .mg-info {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 9px 12px; background: rgba(37,150,217,0.07);
      border: 1px solid rgba(37,150,217,0.18); border-radius: 8px;
      font-size: 11px; color: #4b7ab8; line-height: 1.5;
      margin-bottom: 12px;
    }
    .mg-entry {
      background: #0c1a2e; border: 1px solid #1a3050; border-radius: 8px;
      padding: 10px 12px; margin-bottom: 8px; transition: border-color 0.15s;
    }
    .mg-entry:hover { border-color: #2596D9; }
    .mg-entry-header {
      display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;
    }
    .mg-num { font-size: 10px; font-weight: 700; color: #2596D9; }
    .mg-time { font-size: 10px; color: #1d3a5c; }
    .mg-commit {
      font-size: 9.5px; color: #1d3a5c; font-family: monospace;
      background: #071220; padding: 1px 5px; border-radius: 3px;
    }
    .mg-branch {
      font-size: 9.5px; color: #3d6494;
      background: rgba(37,150,217,0.08); padding: 1px 5px; border-radius: 3px;
    }
    .mg-prompt {
      font-size: 11px; color: #4b7ab8; font-style: italic;
      margin-bottom: 6px; line-height: 1.4;
    }
    .mg-summary { font-size: 11.5px; color: #7aabce; line-height: 1.6; white-space: pre-wrap; }
    .mg-path {
      font-size: 10px; color: #1d3a5c; font-family: monospace;
      background: #071220; padding: 4px 8px; border-radius: 5px;
      margin-top: 8px; cursor: pointer; transition: color 0.15s;
      display: flex; align-items: center; gap: 6px;
    }
    .mg-path:hover { color: #2596D9; }
    .mg-path-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mg-empty {
      text-align: center; padding: 24px 0; color: #1d3a5c;
      font-size: 11.5px; line-height: 1.7;
    }
    .mg-empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }

    /* ── Error toast ─────────────────────────────── */
    .toast {
      display: none; position: fixed; bottom: 14px; left: 14px; right: 14px;
      background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35);
      border-radius: 7px; padding: 8px 12px; font-size: 11.5px; color: #f87171;
      z-index: 100;
    }
    .toast.visible { display: block; }
  </style>
</head><body>

  <!-- ── Header ─────────────────────────────────────── -->
  <div class="header">
    <div class="header-logo">${DOLPHIN_SVG}</div>
    <span class="header-title">Tursiops</span>
    <div class="header-avatar" id="avatar-btn">
      ${escapeHtml(initial)}
      <div class="avatar-menu" id="avatar-menu">
        <div style="padding:8px 10px 6px; border-bottom:1px solid #1a3050; margin-bottom:4px;">
          <div style="font-size:11px;font-weight:600;color:#bfdbfe;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(email)}</div>
          <div style="font-size:10px;color:#2596D9;margin-top:2px;">● Gemini active</div>
        </div>
        <button id="menu-key-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:inline;margin-right:6px;vertical-align:middle">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/>
          </svg>
          ${escapeHtml(maskedKey)}
        </button>
        <div class="divider-line"></div>
        <button class="danger" id="menu-signout-btn">Sign out</button>
      </div>
    </div>
  </div>

  <!-- ── Function selector ──────────────────────────── -->
  <div class="fn-selector">
    <div class="fn-label">Select Function</div>
    <select class="fn-select" id="fn-select">
      <option value="pm">🧠 Prompt Memory</option>
      <option value="nav">🧭 Navigator</option>
      <option value="cs">📝 Change Summary</option>
      <option value="mg">🌿 MiniGit</option>
    </select>
  </div>

  <!-- ── Panels ─────────────────────────────────────── -->
  <div class="panel-wrap">

    <!-- Prompt Memory -->
    <div class="panel active" id="panel-pm">
      <!-- Mode toggle -->
      <div class="pm-toggle">
        <button class="pm-toggle-btn active" id="btn-remember">🧠 Remember this</button>
        <button class="pm-toggle-btn" id="btn-forget">🗑️ Forget this</button>
      </div>

      <!-- Input -->
      <div class="pm-input-area">
        <textarea class="pm-textarea" id="pm-textarea"
          placeholder="Paste the prompt you gave to your AI agent…"></textarea>
      </div>
      <button class="pm-submit" id="pm-submit">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Save &amp; Refine with Gemini
      </button>

      <!-- Timeline -->
      <div class="timeline-header">
        <span class="tl-label" id="tl-label">Remember — Timeline</span>
        <button class="tl-open-file" id="tl-open-file">Open .md ↗</button>
      </div>
      <div class="timeline" id="timeline">
        <div class="tl-empty" id="tl-empty">
          No prompts yet.<br/>Paste a prompt above and save it.
        </div>
      </div>
    </div>

    <!-- Navigator -->
    <div class="panel" id="panel-nav">
      <div class="nav-input-row">
        <input class="nav-input" id="nav-input" type="text"
          placeholder="Find auth file, database utils, login screen…" autocomplete="off"/>
        <button class="nav-search-btn" id="nav-search-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Find
        </button>
      </div>
      <div class="nav-results" id="nav-results">
        <div class="nav-empty" id="nav-empty">
          <span class="nav-empty-icon">🧭</span>
          Ask anything about your project files.<br/>
          Gemini scans your workspace and finds<br/>exactly what you need.
        </div>
      </div>
    </div>

    <!-- Change Summary -->
    <div class="panel" id="panel-cs">
      <div class="cs-row">
        <div class="cs-field">
          <label class="cs-label">From commit</label>
          <select class="cs-select" id="cs-from"></select>
        </div>
        <div class="cs-field">
          <label class="cs-label">To commit</label>
          <select class="cs-select" id="cs-to"></select>
        </div>
      </div>
      <button class="cs-btn" id="cs-summarise-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Summarise with Gemini
      </button>
      <div class="cs-result-wrap" id="cs-result-wrap" style="display:none">
        <div class="cs-result-label">
          <span>Summary</span>
        </div>
        <div class="cs-result-body" id="cs-result-body"></div>
      </div>
      <div class="cs-empty" id="cs-empty">
        <span class="cs-empty-icon">📝</span>
        Select two commits above and click<br/>Summarise to see what changed.
      </div>
    </div>

    <!-- MiniGit -->
    <div class="panel" id="panel-mg">
      <div class="mg-info">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;color:#2596D9">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>One change file is saved after every prompt. Tell your IDE agent the path below to revert any change.</span>
      </div>
      <div class="mg-changes" id="mg-changes">
        <div class="mg-empty" id="mg-empty">
          <span class="mg-empty-icon">🌿</span>
          No changes recorded yet.<br/>Changes appear here after each prompt submission.
        </div>
      </div>
    </div>

  </div>

  <div class="toast" id="toast"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // ── State ──────────────────────────────────────────
    let mode = 'remember'; // 'remember' | 'forget'
    let remEntries = [];
    let frgEntries = [];

    // ── Avatar menu ────────────────────────────────────
    document.getElementById('avatar-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const m = document.getElementById('avatar-menu');
      m.style.display = m.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
      document.getElementById('avatar-menu').style.display = 'none';
    });
    document.getElementById('menu-key-btn').onclick    = () => vscode.postMessage({ command: 'change-key' });
    document.getElementById('menu-signout-btn').onclick = () => vscode.postMessage({ command: 'signout' });

    // ── Function selector ──────────────────────────────
    const fnSelect = document.getElementById('fn-select');
    const panels   = { pm: 'panel-pm', nav: 'panel-nav', cs: 'panel-cs', mg: 'panel-mg' };
    fnSelect.addEventListener('change', () => {
      Object.values(panels).forEach(id => {
        document.getElementById(id).classList.remove('active');
      });
      const target = panels[fnSelect.value];
      if (target) { document.getElementById(target).classList.add('active'); }
    });

    // ── Mode toggle ────────────────────────────────────
    function setMode(m) {
      mode = m;
      document.getElementById('btn-remember').classList.toggle('active', m === 'remember');
      document.getElementById('btn-forget').classList.toggle('active',   m === 'forget');
      document.getElementById('pm-textarea').placeholder =
        m === 'remember'
          ? 'Paste the prompt you gave to your AI agent…'
          : 'Paste a prompt you want the AI to stop following…';
      document.getElementById('tl-label').textContent =
        m === 'remember' ? 'Remember — Timeline' : 'Forget — Timeline';
      renderTimeline();
    }
    document.getElementById('btn-remember').onclick = () => setMode('remember');
    document.getElementById('btn-forget').onclick   = () => setMode('forget');

    // ── Submit ─────────────────────────────────────────
    const submitBtn  = document.getElementById('pm-submit');
    const textarea   = document.getElementById('pm-textarea');

    submitBtn.addEventListener('click', () => {
      const prompt = textarea.value.trim();
      if (!prompt) { showToast('Please enter a prompt first.'); return; }
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Refining with Gemini…';
      vscode.postMessage({ command: 'pm-add', mode, prompt });
    });

    // ── Timeline render ────────────────────────────────
    function renderTimeline() {
      const entries = mode === 'remember' ? remEntries : frgEntries;
      const tl      = document.getElementById('timeline');
      const empty   = document.getElementById('tl-empty');

      // Remove existing entries (keep the empty div)
      Array.from(tl.querySelectorAll('.tl-entry')).forEach(el => el.remove());

      if (entries.length === 0) {
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      // Reverse to show newest first
      [...entries].reverse().forEach(e => {
        const div = document.createElement('div');
        div.className = 'tl-entry';
        div.dataset.index = e.index;
        div.innerHTML = \`
          <div class="tl-dot"></div>
          <div class="tl-meta">
            <span class="tl-num">#\${e.index}</span>
            <span class="tl-time">\${e.timestamp}</span>
            \${e.gitCommit ? \`<span class="tl-commit">\${e.gitCommit.slice(0,12)}</span>\` : ''}
            \${e.branch ? \`<span class="tl-branch">\${e.branch}</span>\` : ''}
          </div>
          <div class="tl-section-label original">Original</div>
          <div class="tl-text original">\${escHtml(e.raw)}</div>
          <div class="tl-section-label refined" style="margin-top:8px">Refined</div>
          <div class="tl-refined-wrap">
            <textarea class="tl-refined-input" data-index="\${e.index}" rows="2">\${escHtml(e.refined)}</textarea>
            <button class="tl-save-btn" data-index="\${e.index}">Save</button>
          </div>
        \`;
        tl.appendChild(div);
      });

      // Wire up inline save
      tl.querySelectorAll('.tl-save-btn').forEach(btn => {
        btn.onclick = () => {
          const idx     = parseInt(btn.dataset.index);
          const refined = tl.querySelector(\`.tl-refined-input[data-index="\${idx}"]\`).value.trim();
          vscode.postMessage({ command: 'pm-edit', mode, index: idx, refined });
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = 'Save'; }, 1200);
        };
      });

      // Auto-resize textareas
      tl.querySelectorAll('.tl-refined-input').forEach(ta => {
        ta.style.height = ta.scrollHeight + 'px';
        ta.addEventListener('input', () => {
          ta.style.height = 'auto';
          ta.style.height = ta.scrollHeight + 'px';
        });
      });
    }

    // ── Open .md file ──────────────────────────────────
    document.getElementById('tl-open-file').onclick = () =>
      vscode.postMessage({ command: 'open-file', mode });

    // ── Navigator ──────────────────────────────────────
    const navInput     = document.getElementById('nav-input');
    const navSearchBtn = document.getElementById('nav-search-btn');
    const navResults   = document.getElementById('nav-results');

    function doNavSearch() {
      const query = navInput.value.trim();
      if (!query) { return; }
      navSearchBtn.disabled = true;
      navSearchBtn.innerHTML = '<div class="spinner"></div>';
      vscode.postMessage({ command: 'nav-search', query });
    }

    navSearchBtn.onclick = doNavSearch;
    navInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { doNavSearch(); }
    });

    function renderNavResults(results) {
      // Clear all except the empty state div
      Array.from(navResults.querySelectorAll('.nav-result')).forEach(el => el.remove());
      const empty = document.getElementById('nav-empty');

      if (!results || results.length === 0) {
        empty.innerHTML = '<span class="nav-empty-icon">🔍</span>No matching files found.<br/>Try a different description.';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'nav-result';
        div.innerHTML = \`
          <svg class="nav-result-icon" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div class="nav-result-body">
            <div class="nav-result-path">\${escHtml(r.path)}</div>
            <div class="nav-result-reason">\${escHtml(r.reason)}</div>
          </div>
          <button class="nav-result-open" data-path="\${escHtml(r.path)}">Open ↗</button>
        \`;
        // Click whole row or open button — both open the file
        div.addEventListener('click', () => vscode.postMessage({ command: 'nav-open', path: r.path }));
        navResults.appendChild(div);
      });
    }

    // ── Messages from extension host ───────────────────
    window.addEventListener('message', (e) => {
      const msg = e.data;
      switch (msg.command) {
        case 'pm-data':
          remEntries = msg.remember || [];
          frgEntries = msg.forget   || [];
          renderTimeline();
          break;
        case 'pm-loading':
          // spinner already shown
          break;
        case 'pm-added':
          if (msg.mode === 'remember') { remEntries.push(msg.entry); }
          else                         { frgEntries.push(msg.entry); }
          textarea.value = '';
          submitBtn.disabled = false;
          submitBtn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Save &amp; Refine with Gemini\`;
          renderTimeline();
          break;
        case 'pm-edit-done':
          if (msg.mode === 'remember') {
            const e = remEntries.find(x => x.index === msg.index);
            if (e) { e.refined = msg.refined; }
          } else {
            const e = frgEntries.find(x => x.index === msg.index);
            if (e) { e.refined = msg.refined; }
          }
          break;
        case 'pm-error':
          showToast(msg.message);
          submitBtn.disabled = false;
          submitBtn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Save &amp; Refine with Gemini\`;
          break;
        case 'nav-results':
          navSearchBtn.disabled = false;
          navSearchBtn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Find\`;
          renderNavResults(msg.results);
          break;
        case 'nav-error':
          navSearchBtn.disabled = false;
          navSearchBtn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Find\`;
          showToast(msg.message);
          break;

        // ── Change Summary ──────────────────────────────
        case 'cs-commits': {
          const fromSel = document.getElementById('cs-from');
          const toSel   = document.getElementById('cs-to');
          fromSel.innerHTML = '';
          toSel.innerHTML   = '';
          if (!msg.commits || msg.commits.length === 0) {
            const opt = '<option value="">No git history found</option>';
            fromSel.innerHTML = opt;
            toSel.innerHTML   = opt;
            break;
          }
          msg.commits.forEach((c, i) => {
            const label = escHtml(c.hash.slice(0,7) + ' ' + c.message.slice(0,40));
            fromSel.innerHTML += \`<option value="\${escHtml(c.hash)}" \${i === 1 ? 'selected' : ''}>\${label}</option>\`;
            toSel.innerHTML   += \`<option value="\${escHtml(c.hash)}" \${i === 0 ? 'selected' : ''}>\${label}</option>\`;
          });
          break;
        }
        case 'cs-loading':
          document.getElementById('cs-summarise-btn').disabled = true;
          document.getElementById('cs-summarise-btn').innerHTML = '<div class="spinner"></div> Summarising…';
          document.getElementById('cs-result-wrap').style.display = 'none';
          document.getElementById('cs-empty').style.display = 'none';
          break;
        case 'cs-result': {
          const btn = document.getElementById('cs-summarise-btn');
          btn.disabled = false;
          btn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Summarise with Gemini\`;
          document.getElementById('cs-result-body').textContent = msg.summary;
          document.getElementById('cs-result-wrap').style.display = 'block';
          document.getElementById('cs-empty').style.display = 'none';
          break;
        }
        case 'cs-error': {
          const btn = document.getElementById('cs-summarise-btn');
          btn.disabled = false;
          btn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Summarise with Gemini\`;
          showToast(msg.message);
          break;
        }

        // ── MiniGit ─────────────────────────────────────
        case 'mg-data': {
          const container = document.getElementById('mg-changes');
          const mgEmpty   = document.getElementById('mg-empty');
          Array.from(container.querySelectorAll('.mg-entry')).forEach(el => el.remove());

          if (!msg.changes || msg.changes.length === 0) {
            mgEmpty.style.display = 'block';
            break;
          }
          mgEmpty.style.display = 'none';

          [...msg.changes].reverse().forEach(c => {
            const div = document.createElement('div');
            div.className = 'mg-entry';
            div.innerHTML = \`
              <div class="mg-entry-header">
                <span class="mg-num">#\${c.index}</span>
                <span class="mg-time">\${escHtml(c.timestamp)}</span>
                \${c.gitCommit ? \`<span class="mg-commit">\${escHtml(c.gitCommit.slice(0,12))}</span>\` : ''}
                \${c.branch    ? \`<span class="mg-branch">\${escHtml(c.branch)}</span>\` : ''}
              </div>
              \${c.prompt ? \`<div class="mg-prompt">"\${escHtml(c.prompt)}"</div>\` : ''}
              <div class="mg-summary">\${escHtml(c.summary || 'No summary available.')}</div>
              <div class="mg-path" data-index="\${c.index}">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="mg-path-text">.tursiops/changes/change_\${c.index}.md</span>
                <span style="color:#3d6494">↗ open</span>
              </div>
            \`;
            div.querySelector('.mg-path').addEventListener('click', () => {
              vscode.postMessage({ command: 'mg-open-file', index: c.index });
            });
            container.appendChild(div);
          });
          break;
        }
      }
    });

    // ── Toast ──────────────────────────────────────────
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('visible');
      setTimeout(() => t.classList.remove('visible'), 3500);
    }

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Change Summary: wire up summarise button ───────
    document.getElementById('cs-summarise-btn').addEventListener('click', () => {
      const hashA = document.getElementById('cs-from').value;
      const hashB = document.getElementById('cs-to').value;
      if (!hashA || !hashB) { showToast('Select two commits first.'); return; }
      vscode.postMessage({ command: 'cs-summarise', hashA, hashB });
    });

    // ── Init: load existing entries ────────────────────
    vscode.postMessage({ command: 'pm-load' });
    vscode.postMessage({ command: 'cs-load-commits' });
    vscode.postMessage({ command: 'mg-load' });
  </script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let n = '';
  for (let i = 0; i < 32; i++) { n += chars[Math.floor(Math.random() * chars.length)]; }
  return n;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Extension lifecycle
// ---------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext): void {
  console.log('Tursiops is now active!');

  const provider = new TursiopsViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TursiopsViewProvider.viewId, provider),
  );

  // URI handler: vscode://Conquestcore.tursiops-ai/auth?token=JWT&email=...
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): void {
        if (uri.path !== '/auth') { return; }
        const params = new URLSearchParams(uri.query);
        const token  = params.get('token');
        const email  = params.get('email');
        if (token && email) {
          provider.applyToken(token, email);
        } else {
          vscode.window.showErrorMessage('Tursiops: sign-in failed — missing token or email.');
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('Tursiops.helloWorld', () => {
      vscode.window.showInformationMessage('Hello World from Tursiops!');
    }),
  );

  // Watch for git commits → reset memory + changes
  CT.watchGitReset(context); // watches .git/COMMIT_EDITMSG — resets memory/ + changes/ on commit
}

export function deactivate(): void {}
