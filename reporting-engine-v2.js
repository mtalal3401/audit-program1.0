// reporting-engine-v2.js — Professional Reporting Engine v2

import { normalizeBalance, splitDrCr, variance } from "./formatters.js";

// Heuristic: identify adjustment entries (for TB adjustment columns)
// You can change prefixes anytime without schema change.
export function isAdjustmentEntry(row, prefixes=["ADJ","JV","AJ"]){
  const v = String(row?.voucher_no || "").trim().toUpperCase();
  if(!v) return false;
  return prefixes.some(p => v.startsWith(String(p).toUpperCase()));
}

// Build Trial Balance for an engagement (current year)
// Returns map: account_code -> { account_code, account_name, normal_balance, cy_net, cy_dr, cy_cr, adj_dr, adj_cr }
export function buildTrialBalance({ coaRows, glRows, adjustmentPrefixes }){
  const coaMap = new Map();
  (coaRows||[]).forEach(a => coaMap.set(String(a.account_code), a));

  const acc = new Map();

  for(const r of (glRows||[])){
    const code = String(r.account_code || "").trim();
    if(!code) continue;
    const coa = coaMap.get(code);
    if(!coa) continue;

    if(!acc.has(code)){
      acc.set(code, {
        account_code: code,
        account_name: coa.account_name || "",
        normal_balance: (coa.normal_balance || "D").toUpperCase(),
        statement: (coa.statement || null),
        section: (coa.section || null),
        line_item: (coa.line_item || null),
        dr: 0,
        cr: 0,
        adj_dr_raw: 0,
        adj_cr_raw: 0
      });
    }
    const x = acc.get(code);
    const dr = Number(r.debit || 0);
    const cr = Number(r.credit || 0);
    x.dr += dr;
    x.cr += cr;

    if(isAdjustmentEntry(r, adjustmentPrefixes)){
      x.adj_dr_raw += dr;
      x.adj_cr_raw += cr;
    }
  }

  // Finalize net and column split
  const out = new Map();
  for(const [code, x] of acc.entries()){
    const net = normalizeBalance(x.normal_balance, x.dr, x.cr);
    const s = splitDrCr(net);

    // adjustments: show as *movement* columns (same sign logic)
    const adjNet = normalizeBalance(x.normal_balance, x.adj_dr_raw, x.adj_cr_raw);
    const adj = splitDrCr(adjNet);

    out.set(code, {
      ...x,
      cy_net: net,
      cy_dr: s.dr,
      cy_cr: s.cr,
      adj_dr: adj.dr,
      adj_cr: adj.cr
    });
  }
  return out;
}

// Build FS data grouped by section/line_item or summarized
// level: "account" | "line_item" | "section"
export function buildStatement({ tbMap, statementName, level="line_item" }){
  // tbMap: Map(account_code -> TBRow)
  const rows = Array.from(tbMap.values()).filter(r => String(r.statement||"").toUpperCase() === statementName);

  const bucket = new Map();
  const keyOf = (r) => {
    if(level === "account") return `A|${r.section||""}|${r.line_item||""}|${r.account_code}`;
    if(level === "section") return `S|${r.section||""}`;
    return `L|${r.section||""}|${r.line_item||""}`;
  };

  for(const r of rows){
    const k = keyOf(r);
    if(!bucket.has(k)){
      bucket.set(k, {
        section: r.section || "—",
        line_item: r.line_item || (level === "section" ? "" : "—"),
        account_code: r.account_code,
        account_name: r.account_name,
        amount: 0
      });
    }
    bucket.get(k).amount += Number(r.cy_net || 0);
  }

  const out = Array.from(bucket.values());
  // sort: section then line item then account_code
  out.sort((a,b)=>{
    const sa = String(a.section||"");
    const sb = String(b.section||"");
    if(sa !== sb) return sa.localeCompare(sb);
    const la = String(a.line_item||"");
    const lb = String(b.line_item||"");
    if(la !== lb) return la.localeCompare(lb);
    return String(a.account_code||"").localeCompare(String(b.account_code||""));
  });
  return out;
}

// Merge multiple years: baseRows (current) + comparisons
// Returns array with dynamic columns: years[]
export function mergeYears({ currentYear, currentRows, compareYears }){
  // compareYears: Array<{ yearLabel, rows: Array<{section,line_item,account_code,account_name,amount}> }>

  // key by the most granular identity available
  const keyOf = (r)=> `${r.section}||${r.line_item}||${r.account_code||""}||${r.account_name||""}`;
  const map = new Map();

  // current
  for(const r of (currentRows||[])){
    const k = keyOf(r);
    map.set(k, { ...r, years: { [currentYear]: Number(r.amount||0) } });
  }

  // comparisons
  for(const cy of (compareYears||[])){
    for(const r of (cy.rows||[])){
      const k = keyOf(r);
      if(!map.has(k)){
        map.set(k, { ...r, years: { [currentYear]: 0 } });
      }
      map.get(k).years[cy.yearLabel] = Number(r.amount||0);
    }
  }

  return Array.from(map.values());
}

export function computeVarianceColumns({ rows, yearA, yearB }){
  // Adds var and varPct for two years (A vs B)
  return (rows||[]).map(r=>{
    const a = Number(r.years?.[yearA] || 0);
    const b = Number(r.years?.[yearB] || 0);
    return {
      ...r,
      var_amount: variance(a, b),
      var_base: b,
    };
  });
}
