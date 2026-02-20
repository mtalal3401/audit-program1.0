// formatters.js — Reporting Engine v2

// Date format: DD/MMM/YYYY (e.g., 30/Jun/2025)
export function formatDateDDMMMYYYY(dateStr){
  if(!dateStr) return "";
  const d = new Date(dateStr);
  if(Number.isNaN(d.getTime())) return String(dateStr);
  const dd = String(d.getDate()).padStart(2,"0");
  const mmm = d.toLocaleString("en-GB", { month: "short" });
  const yyyy = d.getFullYear();
  return `${dd}/${mmm}/${yyyy}`;
}

// Number format: 12,345 and negatives as (12,345)
export function formatNumber(val){
  if(val === null || val === undefined || val === "") return "";
  const n = Number(val);
  if(Number.isNaN(n)) return String(val);
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return n < 0 ? `(${abs})` : abs;
}

// Accounting balance normalization:
// - Debit normal: Dr - Cr
// - Credit normal: Cr - Dr
export function normalizeBalance(normal_balance, debit, credit){
  const dr = Number(debit || 0);
  const cr = Number(credit || 0);
  const nb = String(normal_balance || "").toUpperCase();
  if(nb === "C") return cr - dr;
  return dr - cr;
}

// Split a signed balance into Dr/Cr columns
export function splitDrCr(amount){
  const n = Number(amount || 0);
  return {
    dr: n > 0 ? n : 0,
    cr: n < 0 ? Math.abs(n) : 0
  };
}

export function variance(cy, py){
  return Number(cy || 0) - Number(py || 0);
}

export function variancePct(cy, py){
  const a = Number(cy || 0);
  const b = Number(py || 0);
  if(b === 0) return null;
  return (a - b) / b;
}

export function isMajorVariance(cy, py, pctThreshold=0.25, absThreshold=500000){
  const a = Number(cy || 0);
  const b = Number(py || 0);
  const v = a - b;
  if(Math.abs(v) < absThreshold) return false;
  if(b === 0) return Math.abs(a) >= absThreshold;
  return Math.abs(v / b) >= pctThreshold;
}
