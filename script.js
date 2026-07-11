/* =============================================
   MyCalculator – script.js
   ============================================= */

'use strict';

// =============================================
// STATE
// =============================================
let currentValue   = '0';
let previousValue  = '';
let operator       = null;
let shouldReset    = false;   // reset display on next digit press
let expression     = '';      // full expression string shown above display
let pendingResult  = null;    // stores the computed result until unlocked

// =============================================
// DISPLAY HELPERS
// =============================================
function updateDisplay() {
  const displayVal  = document.getElementById('display-value');
  const displayExpr = document.getElementById('display-expression');

  displayVal.textContent  = currentValue;
  displayExpr.textContent = expression;

  // Dynamically shrink font for long numbers
  const len = currentValue.length;
  displayVal.classList.remove('small', 'xs');
  if (len > 14) displayVal.classList.add('xs');
  else if (len > 9)  displayVal.classList.add('small');
}

// =============================================
// INPUT – DIGITS
// =============================================
function inputDigit(digit) {
  if (shouldReset) {
    currentValue = digit;
    shouldReset  = false;
  } else {
    currentValue = currentValue === '0' ? digit : currentValue + digit;
  }
  updateDisplay();
}

// =============================================
// INPUT – DECIMAL
// =============================================
function inputDot() {
  if (shouldReset) {
    currentValue = '0.';
    shouldReset  = false;
  } else if (!currentValue.includes('.')) {
    currentValue += '.';
  }
  updateDisplay();
}

// =============================================
// INPUT – OPERATOR
// =============================================
function inputOperator(op) {
  if (operator && !shouldReset) {
    // Chain calculation
    const result = computeResult(parseFloat(previousValue), parseFloat(currentValue), operator);
    currentValue  = formatNumber(result);
    previousValue = currentValue;
    expression    = `${currentValue} ${op}`;
  } else {
    previousValue = currentValue;
    expression    = `${currentValue} ${op}`;
  }
  operator    = op;
  shouldReset = true;
  updateDisplay();
}

// =============================================
// CALCULATE
// =============================================
function calculate() {
  if (!operator || shouldReset) return;

  // Immediately blur the card so there's absolutely no delay
  const card = document.getElementById('calculator-card');
  if (card) {
    card.classList.add('blurred');
  }

  const a = parseFloat(previousValue);
  const b = parseFloat(currentValue);

  const result = computeResult(a, b, operator);

  // Store full expression for preview
  const fullExpr = `${previousValue} ${operator} ${currentValue} =`;

  pendingResult = formatNumber(result);

  // Show expression above, but do NOT show the result on the display yet
  expression    = fullExpr;
  updateDisplay();

  // Open payment gate
  openPaymentModal(pendingResult, fullExpr);
}

// =============================================
// COMPUTE
// =============================================
function computeResult(a, b, op) {
  switch (op) {
    case '÷': return b !== 0 ? a / b : NaN;
    case '×': return a * b;
    case '−': return a - b;
    case '+': return a + b;
    default:  return b;
  }
}

function formatNumber(num) {
  if (isNaN(num)) return 'Error';
  if (!isFinite(num)) return num > 0 ? '∞' : '-∞';

  // Up to 16 significant digits
  let str = parseFloat(num.toPrecision(16)).toString();

  // Remove trailing zeros after decimal
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }
  return str;
}

// =============================================
// CLEAR & BACKSPACE
// =============================================
function clearAll() {
  currentValue  = '0';
  previousValue = '';
  operator      = null;
  shouldReset   = false;
  expression    = '';
  pendingResult = null;
  updateDisplay();
}

function backspace() {
  if (shouldReset || currentValue === '0') return;
  currentValue = currentValue.length > 1
    ? currentValue.slice(0, -1)
    : '0';
  updateDisplay();
}

// =============================================
// SCIENTIFIC FUNCTIONS
// =============================================
function sciFunc(fn) {
  const val = parseFloat(currentValue);
  let result;

  switch (fn) {
    case 'sin':  result = Math.sin(val * Math.PI / 180); break;
    case 'cos':  result = Math.cos(val * Math.PI / 180); break;
    case 'tan':  result = Math.tan(val * Math.PI / 180); break;
    case 'log':  result = Math.log10(val);              break;
    case 'ln':   result = Math.log(val);                break;
    case 'sqrt': result = Math.sqrt(val);               break;
    case 'pow2': result = val * val;                    break;
    case 'pi':   currentValue = Math.PI.toString().slice(0, 16); updateDisplay(); return;
    case 'e':    currentValue = Math.E.toString().slice(0, 16);  updateDisplay(); return;
    case 'pct':  result = val / 100;                    break;
    default:     return;
  }

  expression    = `${fn}(${currentValue}) =`;
  currentValue  = formatNumber(result);
  shouldReset   = true;
  updateDisplay();
}

// =============================================
// FINANCIAL FUNCTIONS
// =============================================
const TAX_RATE = 0.11; // 11% (PPN Indonesia)

function finFunc(fn) {
  const val = parseFloat(currentValue);
  let result;

  switch (fn) {
    case 'tax+': result = val * (1 + TAX_RATE); expression = `${currentValue} +TAX =`; break;
    case 'tax-': result = val / (1 + TAX_RATE); expression = `${currentValue} -TAX =`; break;
    case 'gst':  result = val * TAX_RATE;        expression = `GST(${currentValue}) =`; break;
    default: return;
  }

  currentValue  = formatNumber(result);
  shouldReset   = true;
  updateDisplay();
}

// =============================================
// MODE SWITCHER
// =============================================
function switchMode(mode) {
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`nav-${mode}`).classList.add('active');

  // Show / hide keypads
  const basicPad   = document.getElementById('keypad-basic');
  const sciPad     = document.getElementById('keypad-scientific');
  const finPad     = document.getElementById('keypad-financial');

  [basicPad, sciPad, finPad].forEach(el => el.classList.add('hidden'));

  if (mode === 'basic') {
    basicPad.classList.remove('hidden');
    basicPad.style.display = '';
  } else if (mode === 'scientific') {
    sciPad.classList.remove('hidden');
    sciPad.style.display = 'grid';
  } else if (mode === 'financial') {
    finPad.classList.remove('hidden');
    finPad.style.display = 'grid';
  }

  clearAll();
}

// =============================================
// PAYMENT / ACTIVATION MODAL
// =============================================

/**
 * Generate today's valid activation code.
 * Format: YANN[DD][MM]
 * e.g. on July 11 2026 → YANN1107
 */
function getTodayCode() {
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, '0');
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  return `YANN${dd}${mm}`;
}

/**
 * Given a user-supplied code, check if it is
 * valid for TODAY's date (same dd and mm).
 *
 * Returns: 'valid' | 'expired' | 'invalid'
 */
function validateCode(input) {
  const code = input.trim().toUpperCase();

  // Must start with YANN and be followed by 4 digits
  const match = code.match(/^YANN(\d{2})(\d{2})$/);
  if (!match) return 'invalid';

  const codeDd = parseInt(match[1], 10);
  const codeMm = parseInt(match[2], 10);

  const now    = new Date();
  const todayDd = now.getDate();
  const todayMm = now.getMonth() + 1;

  if (codeDd === todayDd && codeMm === todayMm) {
    return 'valid';
  }
  return 'expired';
}

// ---- Open Modal ----
function openPaymentModal(result, expr) {
  const overlay  = document.getElementById('modal-overlay');
  const card     = document.getElementById('calculator-card');
  const blurText = document.getElementById('result-blur-text');
  const preview  = document.getElementById('result-preview');
  const lockBadge = preview.querySelector('.lock-badge');

  // Reset modal state
  document.getElementById('modal-body-main').classList.remove('hidden');
  document.getElementById('modal-success').classList.add('hidden');
  preview.classList.remove('revealed');
  blurText.textContent = result || '????';
  blurText.style.filter = '';
  blurText.style.color  = '';
  if (lockBadge) lockBadge.style.display = '';

  // Reset input
  const codeInput = document.getElementById('activation-code');
  const codeMsg   = document.getElementById('code-message');
  codeInput.value = '';
  codeInput.classList.remove('error', 'valid');
  codeMsg.textContent = '';
  codeMsg.className   = 'code-message hidden';

  // Blur calculator card
  card.classList.add('blurred');

  // Show modal
  overlay.classList.add('open');

  // Focus input after animation
  setTimeout(() => codeInput.focus(), 320);
}

// ---- Close Modal ----
function closeModal(resetCalc = false) {
  const overlay = document.getElementById('modal-overlay');
  const card    = document.getElementById('calculator-card');
  overlay.classList.remove('open');
  card.classList.remove('blurred');
  if (resetCalc) {
    clearAll();
  }
}

// ---- Verify Code ----
function verifyCode() {
  const codeInput = document.getElementById('activation-code');
  const codeMsg   = document.getElementById('code-message');
  const userCode  = codeInput.value;

  if (!userCode.trim()) {
    showMsg(codeMsg, codeInput, '⚠️ Masukkan kode aktivasi terlebih dahulu.', 'error-msg');
    return;
  }

  const status = validateCode(userCode);

  if (status === 'valid') {
    // ---- SUCCESS ----
    codeInput.classList.remove('error');
    codeInput.classList.add('valid');
    codeMsg.className   = 'code-message hidden';

    // Reveal blurred result
    const preview  = document.getElementById('result-preview');
    const blurText = document.getElementById('result-blur-text');
    const lockBadge = preview.querySelector('.lock-badge');

    preview.classList.add('revealed');
    blurText.textContent = pendingResult || '0';
    if (lockBadge) lockBadge.style.display = 'none';

    // Update the actual calculator state and screen with the unlocked result
    currentValue  = pendingResult;
    previousValue = '';
    operator      = null;
    shouldReset   = true;
    updateDisplay();

    // Switch to success view after brief reveal
    setTimeout(() => {
      document.getElementById('modal-body-main').classList.add('hidden');
      document.getElementById('modal-success').classList.remove('hidden');

      // Auto close after 2.4 s
      setTimeout(() => closeModal(false), 2400);
    }, 700);

  } else if (status === 'expired') {
    // ---- EXPIRED ----
    codeInput.classList.remove('valid');
    codeInput.classList.add('error');
    showMsg(codeMsg, codeInput, '❌ Kode sudah kadaluarsa. Lakukan donasi baru untuk mendapatkan kode hari ini.', 'error-msg');

  } else {
    // ---- INVALID FORMAT ----
    codeInput.classList.remove('valid');
    codeInput.classList.add('error');
    showMsg(codeMsg, codeInput, '⚠️ Format kode tidak valid. Contoh: YANN1107', 'error-msg');
  }
}

function showMsg(el, input, text, cls) {
  el.textContent = text;
  el.className   = `code-message ${cls}`;

  // Shake animation on input
  input.style.animation = 'none';
  requestAnimationFrame(() => {
    input.style.animation = 'shake 0.4s ease';
  });
}

// Allow Enter key to submit code
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('activation-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') verifyCode();
  });

  // Keyboard support for calculator
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay.classList.contains('open')) return; // block when modal open

    const key = e.key;

    if (key >= '0' && key <= '9') { inputDigit(key); return; }
    if (key === '.')               { inputDot();       return; }
    if (key === '+')               { inputOperator('+'); return; }
    if (key === '-')               { inputOperator('−'); return; }
    if (key === '*')               { inputOperator('×'); return; }
    if (key === '/')               { e.preventDefault(); inputOperator('÷'); return; }
    if (key === 'Enter' || key === '=') { calculate(); return; }
    if (key === 'Backspace')       { backspace(); return; }
    if (key === 'Escape' || key === 'c' || key === 'C') { clearAll(); return; }
  });

  // Ensure basic mode is default
  switchMode('basic');
});

/* ---------- Shake keyframe (injected via JS for simplicity) ---------- */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);
