'use strict';

const STORAGE_KEY = 'sikanda_umkm_transactions_v1';
let transactions = [];

function rupiah(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Rp0';
  const rounded = Math.round(Math.abs(number));
  return `${number < 0 ? '-' : ''}Rp${rounded.toLocaleString('id-ID')}`;
}

function integerLabel(value, unit = 'unit') {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return `0 ${unit}`;
  return `${Math.ceil(number).toLocaleString('id-ID')} ${unit}`;
}

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function showMessage(id, text = '', type = 'error') {
  const element = byId(id);
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('success', type === 'success');
}

function clearInvalid(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(input => input.removeAttribute('aria-invalid'));
}

function markInvalid(input) {
  if (input) input.setAttribute('aria-invalid', 'true');
}

function readNumber(id, label, options = {}) {
  const input = byId(id);
  const raw = input?.value.trim() ?? '';
  if (raw === '') {
    markInvalid(input);
    return { error: `${label} perlu diisi.` };
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    markInvalid(input);
    return { error: `${label} harus berupa angka yang benar.` };
  }
  if (value < 0) {
    markInvalid(input);
    return { error: `${label} tidak boleh menggunakan angka negatif.` };
  }
  if (options.positive && value <= 0) {
    markInvalid(input);
    return { error: `${label} harus lebih besar dari nol.` };
  }
  return { value };
}

function firstNumberError(entries) {
  return entries.find(entry => entry.error)?.error || '';
}

function makeTransactionId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return `trx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => {
      const amount = Number(item?.amount);
      return item && typeof item.id === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') &&
        ['pemasukan', 'pengeluaran'].includes(item.type) &&
        typeof item.category === 'string' &&
        typeof item.description === 'string' &&
        Number.isFinite(amount) && amount > 0;
    }).map(item => ({ ...item, amount: Number(item.amount) }));
  } catch (_) {
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (_) {
    return false;
  }
}

function transactionTotals() {
  return transactions.reduce((totals, item) => {
    if (item.type === 'pemasukan') totals.income += item.amount;
    if (item.type === 'pengeluaran') totals.expense += item.amount;
    return totals;
  }, { income: 0, expense: 0 });
}

function updateSummary() {
  const { income, expense } = transactionTotals();
  const balance = income - expense;
  const values = {
    'summary-income': income,
    'summary-expense': expense,
    'summary-balance': balance,
    'summary-profit': balance,
    'report-income': income,
    'report-expense': expense,
    'report-balance': balance,
    'report-profit': balance
  };

  Object.entries(values).forEach(([id, value]) => setText(id, rupiah(value)));
  byId('summary-balance')?.closest('.summary-card')?.classList.toggle('negative', balance < 0);
  byId('summary-profit')?.closest('.summary-card')?.classList.toggle('negative', balance < 0);
  byId('report-profit')?.closest('.report-result')?.classList.toggle('negative', balance < 0);
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function appendCell(row, value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value;
  if (className) cell.className = className;
  row.appendChild(cell);
  return cell;
}

function renderTransactions() {
  const body = byId('transaction-body');
  const empty = byId('transaction-empty');
  const tableWrap = byId('transaction-table-wrap');
  if (!body || !empty || !tableWrap) return;

  body.replaceChildren();
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  sorted.forEach(item => {
    const row = document.createElement('tr');
    appendCell(row, formatDate(item.date));

    const typeCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `transaction-type ${item.type}`;
    badge.textContent = item.type;
    typeCell.appendChild(badge);
    row.appendChild(typeCell);

    appendCell(row, item.category);
    appendCell(row, item.description);
    appendCell(row, rupiah(item.amount), 'amount');

    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-transaction';
    deleteButton.dataset.transactionId = item.id;
    deleteButton.setAttribute('aria-label', `Hapus transaksi ${item.description}`);
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-trash-can';
    icon.setAttribute('aria-hidden', 'true');
    deleteButton.appendChild(icon);
    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);

    body.appendChild(row);
  });

  const hasTransactions = sorted.length > 0;
  empty.hidden = hasTransactions;
  tableWrap.hidden = !hasTransactions;
  setText('transaction-count', `${sorted.length.toLocaleString('id-ID')} transaksi tercatat`);
  updateSummary();
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearInvalid(form);
  showMessage('transaction-message');

  const date = byId('transaction-date');
  const type = byId('transaction-type');
  const category = byId('transaction-category');
  const description = byId('transaction-description');
  const amount = readNumber('transaction-amount', 'Nominal', { positive: true });

  if (!date.value) {
    markInvalid(date);
    showMessage('transaction-message', 'Tanggal transaksi perlu diisi.');
    date.focus();
    return;
  }
  if (!type.value) {
    markInvalid(type);
    showMessage('transaction-message', 'Pilih jenis transaksi.');
    type.focus();
    return;
  }
  if (!category.value) {
    markInvalid(category);
    showMessage('transaction-message', 'Pilih kategori transaksi.');
    category.focus();
    return;
  }
  if (!description.value.trim()) {
    markInvalid(description);
    showMessage('transaction-message', 'Keterangan transaksi perlu diisi.');
    description.focus();
    return;
  }
  if (amount.error) {
    showMessage('transaction-message', amount.error);
    byId('transaction-amount').focus();
    return;
  }

  transactions.push({
    id: makeTransactionId(),
    date: date.value,
    type: type.value,
    category: category.value,
    description: description.value.trim(),
    amount: amount.value,
    createdAt: Date.now()
  });

  if (!saveTransactions()) {
    transactions.pop();
    showMessage('transaction-message', 'Transaksi belum dapat disimpan pada perangkat ini. Periksa pengaturan penyimpanan browser.');
    return;
  }

  form.reset();
  setDefaultDate();
  showMessage('transaction-message', 'Transaksi berhasil ditambahkan.', 'success');
  renderTransactions();
}

function handleTransactionDelete(event) {
  const button = event.target.closest('.delete-transaction');
  if (!button) return;
  const item = transactions.find(transaction => transaction.id === button.dataset.transactionId);
  if (!item) return;
  if (!window.confirm(`Hapus transaksi “${item.description}”?`)) return;

  const previous = transactions;
  transactions = transactions.filter(transaction => transaction.id !== item.id);
  if (!saveTransactions()) {
    transactions = previous;
    showMessage('transaction-message', 'Transaksi belum dapat dihapus karena penyimpanan browser tidak tersedia.');
    return;
  }
  renderTransactions();
}

function handleHpp(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearInvalid(form);
  const values = [
    readNumber('hpp-material', 'Biaya bahan baku'),
    readNumber('hpp-labor', 'Tenaga kerja'),
    readNumber('hpp-operational', 'Biaya operasional'),
    readNumber('hpp-packaging', 'Kemasan'),
    readNumber('hpp-other', 'Biaya lainnya'),
    readNumber('hpp-quantity', 'Jumlah produk', { positive: true })
  ];
  const error = firstNumberError(values);
  if (error) {
    showMessage('hpp-message', error);
    return;
  }
  const total = values.slice(0, 5).reduce((sum, entry) => sum + entry.value, 0);
  const perProduct = total / values[5].value;
  setText('hpp-total', rupiah(total));
  setText('hpp-unit', rupiah(perProduct));
  showMessage('hpp-message', 'Perhitungan selesai.', 'success');
}

function handleSelling(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearInvalid(form);
  const hpp = readNumber('selling-hpp', 'HPP per produk');
  const margin = readNumber('selling-margin', 'Target keuntungan');
  const error = firstNumberError([hpp, margin]);
  if (error) {
    showMessage('selling-message', error);
    return;
  }
  const result = hpp.value * (1 + margin.value / 100);
  setText('selling-result', rupiah(result));
  showMessage('selling-message', 'Perhitungan selesai.', 'success');
}

function handleBep(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearInvalid(form);
  const fixed = readNumber('bep-fixed', 'Biaya tetap');
  const price = readNumber('bep-price', 'Harga jual per unit');
  const variable = readNumber('bep-variable', 'Biaya variabel per unit');
  const error = firstNumberError([fixed, price, variable]);
  if (error) {
    showMessage('bep-message', error);
    return;
  }
  if (price.value <= variable.value) {
    markInvalid(byId('bep-price'));
    markInvalid(byId('bep-variable'));
    showMessage('bep-message', 'Harga jual harus lebih besar dari biaya variabel per unit agar titik impas dapat dihitung.');
    return;
  }
  const units = Math.ceil(fixed.value / (price.value - variable.value));
  setText('bep-unit', integerLabel(units));
  setText('bep-rupiah', rupiah(units * price.value));
  showMessage('bep-message', 'Perhitungan selesai.', 'success');
}

function handleTarget(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearInvalid(form);
  const profit = readNumber('target-profit', 'Target laba');
  const price = readNumber('target-price', 'Harga jual');
  const cost = readNumber('target-cost', 'Biaya per produk');
  const error = firstNumberError([profit, price, cost]);
  if (error) {
    showMessage('target-message', error);
    return;
  }
  if (price.value <= cost.value) {
    markInvalid(byId('target-price'));
    markInvalid(byId('target-cost'));
    showMessage('target-message', 'Harga jual harus lebih besar dari biaya per produk agar target laba dapat dihitung.');
    return;
  }
  const monthly = Math.ceil(profit.value / (price.value - cost.value));
  const daily = monthly === 0 ? 0 : Math.ceil(monthly / 30);
  setText('target-month', integerLabel(monthly, 'produk'));
  setText('target-day', integerLabel(daily, 'produk'));
  showMessage('target-message', 'Perhitungan selesai.', 'success');
}

function setDefaultDate() {
  const input = byId('transaction-date');
  if (!input || input.value) return;
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  input.value = localDate;
}

function guardNumericInputs() {
  document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('keydown', event => {
      if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault();
    });
    input.addEventListener('input', () => {
      if (input.value !== '' && Number(input.value) < 0) input.value = '';
      input.removeAttribute('aria-invalid');
    });
  });
}

function initSectionNavigation() {
  const links = [...document.querySelectorAll('.finance-nav-link')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;

  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .2, .5] });
  sections.forEach(section => observer.observe(section));
}

document.addEventListener('DOMContentLoaded', () => {
  transactions = loadTransactions();
  setDefaultDate();
  guardNumericInputs();
  renderTransactions();
  initSectionNavigation();

  byId('transaction-form')?.addEventListener('submit', handleTransactionSubmit);
  byId('transaction-body')?.addEventListener('click', handleTransactionDelete);
  byId('hpp-form')?.addEventListener('submit', handleHpp);
  byId('selling-form')?.addEventListener('submit', handleSelling);
  byId('bep-form')?.addEventListener('submit', handleBep);
  byId('target-form')?.addEventListener('submit', handleTarget);
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  transactions = loadTransactions();
  renderTransactions();
});
