# 🧪 ANTI-DETECTION TESTING GUIDE

**Purpose:** Validate that SAFE_AGENT v4.0 fingerprinting protections work correctly
**When to Test:** Before production use, and monthly thereafter
**Time Required:** 15-20 minutes

---

## 🎯 QUICK TEST CHECKLIST

Before running your agent for authorized research, verify:

- [ ] Passes CreepJS bot detection test
- [ ] Passes Fingerprint.js uniqueness test
- [ ] Passes BrowserLeaks canvas test
- [ ] Passes Sannysoft bot detection
- [ ] No "Headless Chrome" detected
- [ ] Canvas fingerprint varies between runs
- [ ] WebGL reports realistic GPU
- [ ] Timezone matches IP location

---

## 📋 DETAILED TESTING PROCEDURE

### TEST 1: CreepJS Comprehensive Detection
**URL:** https://abrahamjuliot.github.io/creepjs/
**What it tests:** Canvas, WebGL, Audio, Fonts, Screen, Timezone, etc.
**Expected result:** Should NOT flag as "Bot" or "Headless"

**Steps:**
1. Run SAFE_AGENT.py
2. Navigate to https://abrahamjuliot.github.io/creepjs/
3. Wait for scan to complete (30-60 seconds)
4. Check results

**✅ PASS Criteria:**
- Trust Score: 70%+ (green or yellow)
- No "Headless Chrome" detected
- No "Automation" detected
- Canvas fingerprint appears normal
- WebGL vendor shows "Intel Inc." or realistic GPU

**❌ FAIL Indicators:**
- Trust Score: <50% (red)
- "Headless Chrome Detected"
- "Automation Software Detected"
- Missing canvas/WebGL data

---

### TEST 2: Fingerprint.js Demo
**URL:** https://fingerprint.com/demo/
**What it tests:** Browser uniqueness and fingerprinting
**Expected result:** Should appear as normal Chrome browser

**Steps:**
1. Run SAFE_AGENT.py
2. Navigate to https://fingerprint.com/demo/
3. Click "Get my fingerprint"
4. Review components

**✅ PASS Criteria:**
- No "Bot detected" warning
- All components show green checkmarks
- Canvas fingerprint present
- WebGL fingerprint present
- Screen resolution realistic

**❌ FAIL Indicators:**
- Red "Bot detected" badge
- Missing fingerprint components
- Suspicious "Confidence Score"

---

### TEST 3: BrowserLeaks Comprehensive Suite
**URL:** https://browserleaks.com/
**What it tests:** All browser leaks and fingerprinting methods
**Expected result:** Should match normal user browser

**Sub-tests to run:**

#### 3a. Canvas Fingerprinting
**URL:** https://browserleaks.com/canvas
**Steps:**
1. Navigate to canvas test
2. Check if canvas fingerprint is generated
3. Run test twice - fingerprints should be SLIGHTLY different (noise working)

**✅ PASS:** Canvas renders, but hash differs slightly between runs

#### 3b. WebGL Fingerprinting
**URL:** https://browserleaks.com/webgl
**Steps:**
1. Navigate to WebGL test
2. Check vendor and renderer

**✅ PASS Criteria:**
- Vendor: "Intel Inc."
- Renderer: "Intel Iris OpenGL Engine" (or similar realistic GPU)
- NOT: "Google SwiftShader" or "Mesa" (software rendering = bot signal)

#### 3c. Audio Context
**URL:** https://browserleaks.com/audio
**Steps:**
1. Run audio fingerprinting test
2. Check if audio context is available and varies

**✅ PASS:** Audio fingerprint generated and varies between sessions

#### 3d. Screen Resolution
**URL:** https://browserleaks.com/screen
**Steps:**
1. Check reported screen properties
2. Verify matches window size

**✅ PASS Criteria:**
- availWidth matches innerWidth
- availHeight matches innerHeight
- colorDepth: 24
- devicePixelRatio: 1

---

### TEST 4: Sannysoft Bot Detection
**URL:** https://bot.sannysoft.com/
**What it tests:** Common bot detection methods
**Expected result:** ALL tests should show PASS (green)

**Steps:**
1. Run SAFE_AGENT.py
2. Navigate to https://bot.sannysoft.com/
3. Review all test results

**✅ PASS Criteria (ALL must be green):**
- ✅ WebDriver: false
- ✅ Chrome: present
- ✅ Permissions: consistent
- ✅ Plugins: present (3+ plugins)
- ✅ Languages: ['en-US', 'en']
- ✅ WebGL Vendor: Realistic
- ✅ WebGL Renderer: Realistic

**❌ FAIL Indicators:**
- ❌ WebDriver: true (RED FLAG)
- ❌ Chrome: undefined (RED FLAG)
- ❌ Plugins: empty or missing
- ❌ WebGL: SwiftShader/Mesa

---

### TEST 5: Pixelscan Advanced Detection
**URL:** https://pixelscan.net/
**What it tests:** Advanced bot detection and consistency
**Expected result:** Consistency score 95%+

**Steps:**
1. Run SAFE_AGENT.py
2. Navigate to https://pixelscan.net/
3. Complete scan
4. Review consistency report

**✅ PASS Criteria:**
- Consistency Score: 95%+
- No major red flags
- Canvas fingerprint: Present
- WebGL: Realistic GPU

---

## 🔬 ADVANCED TESTING

### Canvas Fingerprint Noise Test
**Purpose:** Verify canvas noise is working (prevents exact fingerprinting)

**Steps:**
1. Open Python console in SAFE_AGENT browser (F12)
2. Run this code twice:

```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 200;
canvas.height = 50;
ctx.font = '14px Arial';
ctx.fillText('Browser fingerprinting test', 10, 25);
console.log(canvas.toDataURL());
```

**✅ PASS:** The two outputs should be SLIGHTLY different (last few characters of base64 string differ)
**❌ FAIL:** Outputs are identical (noise not working)

---

### WebGL Fingerprint Test
**Purpose:** Verify WebGL is spoofed correctly

**Steps:**
1. Open browser console (F12)
2. Run:

```javascript
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl');
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
console.log('Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
console.log('Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
```

**✅ PASS:**
- Vendor: "Intel Inc."
- Renderer: "Intel Iris OpenGL Engine"

**❌ FAIL:**
- Vendor: "Google Inc." (software rendering)
- Renderer: "ANGLE" or "SwiftShader"

---

### Hardware Concurrency Test
**Purpose:** Verify CPU core randomization

**Steps:**
1. Open console
2. Run: `console.log(navigator.hardwareConcurrency)`
3. Restart agent and check again

**✅ PASS:** Value is realistic (4, 6, 8, or 12) and varies between sessions
**❌ FAIL:** Value is same every time or unrealistic (1, 2, 64, etc.)

---

## 🌍 TIMEZONE VERIFICATION

**Critical:** Timezone must match IP geolocation!

### Check Current Timezone:
```bash
timedatectl
```

### Check IP Geolocation:
```bash
curl ipinfo.io
```

### Verify Match:
**If IP shows "New York" but timezone is "UTC" = RED FLAG**

### Fix Timezone:
```bash
# Example for US East Coast:
sudo timedatectl set-timezone America/New_York

# Example for US West Coast:
sudo timedatectl set-timezone America/Los_Angeles

# Example for Central Europe:
sudo timedatectl set-timezone Europe/Paris
```

---

## 📊 TEST RESULTS SCORECARD

| Test | Status | Score | Notes |
|------|--------|-------|-------|
| CreepJS | ⬜ | /100 | Trust score |
| Fingerprint.js | ⬜ | Pass/Fail | Bot detection |
| BrowserLeaks Canvas | ⬜ | Pass/Fail | Noise working? |
| BrowserLeaks WebGL | ⬜ | Pass/Fail | GPU realistic? |
| Sannysoft | ⬜ | /15 | Green checks |
| Pixelscan | ⬜ | /100 | Consistency |
| **Overall** | ⬜ | **/600** | **Minimum: 500** |

**Scoring:**
- 500-600: ✅ Excellent - Safe for production
- 400-499: ⚠️ Good - Minor improvements needed
- 300-399: ⚠️ Fair - Review failures
- <300: ❌ Poor - DO NOT USE, fix critical issues

---

## 🚨 TROUBLESHOOTING

### Issue: "Headless Chrome Detected"
**Cause:** Browser is running in headless mode
**Fix:** SAFE_AGENT.py doesn't use headless - check if you modified chrome_options

### Issue: WebGL shows "SwiftShader" or "ANGLE"
**Cause:** Hardware acceleration disabled
**Fix:** Remove `--disable-gpu` flag if present

### Issue: Canvas fingerprint identical every run
**Cause:** Noise function not working
**Fix:** Check SAFE_AGENT.py lines 219-248 - ensure noise() function is defined

### Issue: navigator.webdriver = true
**Cause:** Anti-detection scripts not running
**Fix:** Check SAFE_AGENT.py lines 190-327 - ensure execute_script runs successfully

### Issue: Timezone mismatch
**Cause:** System timezone doesn't match IP location
**Fix:** Run: `sudo timedatectl set-timezone [your_timezone]`

---

## ✅ PRE-PRODUCTION CHECKLIST

Before using agent for authorized research:

**System Configuration:**
- [ ] Timezone matches IP geolocation
- [ ] Using residential IP (not VPS/datacenter)
- [ ] Chrome/Chromium installed and updated
- [ ] ChromeDriver compatible with Chrome version

**Agent Configuration:**
- [ ] Using SAFE_AGENT.py v4.0 (not ULTIMATE_AGENT or others)
- [ ] Daily limit set appropriately (15 jobs for new accounts)
- [ ] Session limit configured (6 hours)
- [ ] Break intervals set (every 3 jobs)

**Testing:**
- [ ] Passed CreepJS (score 70+)
- [ ] Passed Sannysoft (all green)
- [ ] Canvas noise working (fingerprints vary)
- [ ] WebGL spoofed correctly (realistic GPU)
- [ ] Overall test score: 500+

**Operational:**
- [ ] Payment tracking log file accessible
- [ ] Screenshots directory created
- [ ] Have credentials for test accounts
- [ ] Understand how to stop agent (Ctrl+C)

---

## 📅 ONGOING MONITORING

**Weekly:**
- [ ] Review payment logs for accuracy
- [ ] Check for any warning emails
- [ ] Monitor acceptance rate (should be 95%+)

**Monthly:**
- [ ] Re-run full test suite
- [ ] Update ChromeDriver if needed
- [ ] Check for new detection methods
- [ ] Review and adjust daily limits if account mature

**Quarterly:**
- [ ] Full security audit
- [ ] Test with latest bot detection tools
- [ ] Review and update anti-detection scripts

---

## 🔗 USEFUL TESTING RESOURCES

**Bot Detection Tests:**
- CreepJS: https://abrahamjuliot.github.io/creepjs/
- Fingerprint.js: https://fingerprint.com/demo/
- Sannysoft: https://bot.sannysoft.com/
- Pixelscan: https://pixelscan.net/
- Incolumitas: https://bot.incolumitas.com/

**Fingerprinting Tests:**
- BrowserLeaks: https://browserleaks.com/
- AmIUnique: https://amiunique.org/
- Cover Your Tracks: https://coveryourtracks.eff.org/
- DeviceInfo: https://www.deviceinfo.me/

**IP/Timezone Validation:**
- IPInfo: https://ipinfo.io/
- WhatIsMyIP: https://www.whatismyip.com/
- TimeZoneDB: https://timezonedb.com/

---

## 📝 TEST LOG TEMPLATE

```
Date: ___________
Tester: ___________
Agent Version: SAFE_AGENT v4.0

CreepJS Score: ____/100
Sannysoft: All Green? Yes/No
Canvas Noise: Working? Yes/No
WebGL Vendor: ___________
Timezone Match: Yes/No

Overall Rating: ___/600
Safe for Production: Yes/No

Notes:
_________________________________
_________________________________
_________________________________

Next Test Date: ___________
```

---

**Last Updated:** 2025-11-24
**Next Review:** Monthly
**Questions:** Refer to SECURITY_AUDIT_REPORT.md
