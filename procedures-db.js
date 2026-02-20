// procedures-db.js  –  v2.1
// Audit Program database (editable).
// Load this file BEFORE app.js
//
// Fixes applied vs v2.0:
//  1. PAY, TAX and RP areas were accidentally placed OUTSIDE the `areas` object — now fixed.
//  2. PAY-TOD-01 was duplicated four times — now PAY-TOD-01 through PAY-TOD-04 are unique.
//  3. LTD Test-of-Details IDs all had wrong prefix ("LTD-TOC-*") — corrected to "LTD-TOD-*".
//     Typos "LTC-TOC-04" and "LDT-TOC-06" also corrected.
//  4. CAL-TOC-04 had a wrong area prefix ("PAY-TOC-04") — corrected.
//
// Structure expected by app.js:
// window.PROGRAM_DB = {
//   meta: {...},
//   contents: [{ sectionTitle, items:[{key,label}] }],
//   areas: {
//     AREA_KEY: { title, procedures: { "Analytical Procedures": [{heading,text,id?},...], ... } }
//   }
// };

(() => {
  const proc = (heading, text, id) => ({ heading, text, id });

  window.PROGRAM_DB = {
    meta: {
      version: "2.1",
      lastUpdated: new Date().toISOString(),
      owner: "MT - FY & Co."
    },

    // ── Left-side Contents (grouping) ──────────────────────────────────────
contents: [
  {
    sectionTitle: "Financial Statements",
    items: [
      { key: "FS_GL",    label: "General Ledger (Upload)" },
      { key: "FS_COA",   label: "Chart of Accounts (Upload)" },
      { key: "FS_TB",    label: "Trial Balance" },
      { key: "FS_AJE",   label: "Adjusting Entries (JV)" },
      { key: "FS_SOFP",  label: "Statement of Financial Position" },
      { key: "FS_SOPL",  label: "Statement of Financial Performance" },
      { key: "FS_CFS",   label: "Statement of Cash Flow (Indirect)" },
      { key: "FS_SOCE",  label: "Statement of Changes in Equity" }
    ]
  },
  {
    sectionTitle: "Audit Program",
    items: [
      { key: "PPE",  label: "Property, Plant and Equipment" },
      { key: "LTD",  label: "Long Term Deposits" },
      { key: "TD",   label: "Trade Debts" },
      { key: "ADV",  label: "Advances, deposits, prepayments and other receivables" },
      { key: "CASH", label: "Cash & Bank" },
      { key: "CAL",  label: "Creditors, accrued and other liabilities" },
      { key: "REV",  label: "Revenue" },
      { key: "OC",   label: "Operating Cost - Overall" },
      { key: "PAY",  label: "Operating Cost - Payroll" },
      { key: "TAX",  label: "Taxation" },
      { key: "RP",   label: "Related Party Transactions" }
    ]
  }
],


    // ── Audit Areas + Procedures ───────────────────────────────────────────
    areas: {

      // ======================================================================
      // PPE  –  Property, Plant and Equipment
      // ======================================================================
      PPE: {
        title: "Property, Plant and Equipment",
        procedures: {
          "Analytical Procedures": [
            proc("Movement", "Explain movement and investigate unusual relationships vs prior year for acquisition by asset class.", "PPE-AP-01"),
            proc("Movement", "Explain movement and investigate unusual relationships vs prior year for disposals by asset class.", "PPE-AP-02"),
            proc("Movement", "Compare depreciation expense vs prior year; investigate significant variances.", "PPE-AP-03"),
            proc("Movement", "Compare repair & maintenance expense vs prior year; investigate unusual items.", "PPE-AP-04"),
            proc("General",  "Review G/L for large or unusual entries; inquire about nature and reasons.", "PPE-AP-05")
          ],
          "Test of Controls": [
            proc("Authorization", "Test whether asset purchases are approved by designated authority / forum as per delegated authority matrix.", "PPE-TOC-01"),
            proc("Recording",     "Test whether goods received are promptly recorded in the fixed asset register (FAR).", "PPE-TOC-02"),
            proc("Custody",       "Test that asset tagging / asset codes exist and are linked to FAR.", "PPE-TOC-03"),
            proc("Depreciation",  "Test whether depreciation is system-calculated per approved policy and reviewed.", "PPE-TOC-04")
          ],
          "Test of Details": [
            proc("Additions",             "Select additions across the year; vouch to invoices, GRNs, and approval; check capitalization criteria.", "PPE-TOD-01"),
            proc("Disposals",             "Select disposals; vouch to disposal authorization, sale proceeds, and FAR updates.", "PPE-TOD-02"),
            proc("Depreciation",          "Recalculate depreciation for a sample; agree useful life and method to policy.", "PPE-TOD-03"),
            proc("Impairment",            "If indicators exist, assess impairment considerations and disclosures.", "PPE-TOD-04"),
            proc("Physical verification", "Perform a physical verification of selected assets and reconcile to FAR.", "PPE-TOD-05")
          ]
        }
      },

      // ======================================================================
      // LTD  –  Long Term Deposits
      // FIX: All Test of Details IDs corrected from "LTD-TOC-*" → "LTD-TOD-*".
      //      Typos "LTC-TOC-04" → "LTD-TOD-04" and "LDT-TOC-06" → "LTD-TOD-06" fixed.
      // ======================================================================
      LTD: {
        title: "Long Term Deposits",
        procedures: {
          "Analytical Procedures": [
            proc("General", "Compare current year balances and expense with last year balances and expenses and ensure that any significant variation should be properly and logically reasoned.", "LTD-AP-01")
          ],
          "Test of Controls": [
            proc("General", "Assess the reasonableness of design of system of internal control by enquiring relevant client personnel and documenting the same (if not a documented system manual has been developed by the client). A walk-through test would be necessary to confirm the understanding as documented. Identify the preventive and detective controls established by management to support its assertions.", "LTD-TOC-01"),
            proc("General", "Check on sample of selected transactions covering the whole period that all preventive controls are exercised on all transactions.", "LTD-TOC-02"),
            proc("General", "Check that proper subsidiary records have been maintained and entries are made in the same on prompt and consistent basis and the same is reconciled with general ledger.", "LTD-TOC-03"),
            proc("General", "Check on a sample of transactions that detective controls are appropriately exercised and in case of any detection of error/fraud, proper steps have been taken to avoid recurrence of the same.", "LTD-TOC-04")
          ],
          "Test of Details": [
            proc("General", "Obtain party wise movement schedule of deposits and prepayments and trace the opening balances from the general ledger, subsidiary records, and last year working papers. Check casting and cross casting of the schedule.", "LTD-TOD-01"),
            proc("General", "For deposits and prepayments made during the year check disbursements of funds with disbursement voucher and bank statement.", "LTD-TOD-02"),
            proc("General", "For a sample of refund of deposits during the year: Ensure that amount and date of refund was in accordance with agreement.", "LTD-TOD-03"),
            proc("General", "For a sample of refund of deposits during the year: Check receipt of funds with receipt records and bank statement.", "LTD-TOD-04"),
            proc("General", "Circularize confirmations to selected parties. Match replies with the amounts outstanding against each party.", "LTD-TOD-05"),
            proc("General", "Obtain age-analysis of long-term deposits and verify that deposits have been classified in correct categories.", "LTD-TOD-06"),
            proc("General", "Obtain age-analysis of long-term deposits and verify that current maturity has been appropriately identified and separately disclosed.", "LTD-TOD-07"),
            proc("General", "Check subsequent recovery of deposits and adjustment of prepayments etc.", "LTD-TOD-08"),
            proc("General", "Ensure that none of the deposits or prepayments are impaired or the recoverable amount of same is not less than its carrying amount. If the carrying amount is more than its recoverable amount, same should be reduced to recoverable amount recognizing the reduction as impairment loss.", "LTD-TOD-09"),
            proc("General", "For items stuck-up for considerable period of time, inquire about its status from the management. Compute provisions if required and ask for management representations.", "LTD-TOD-10"),
            proc("General", "Ensure that closing balances as per our working paper file are in match with general ledger.", "LTD-TOD-11"),
            proc("General", "Determine that disclosures have been made in accordance with the requirements of fourth schedule to the Companies Act, 2017 and the applicable IASs.", "LTD-TOD-12")
          ]
        }
      },

      // ======================================================================
      // TD  –  Trade Debts
      // ======================================================================
      TD: {
        title: "Trade Debts",
        procedures: {
          "Analytical Procedures": [
            proc("General", "Compare current year balance with previous year and explain any significant variation.", "TD-AP-01"),
            proc("General", "Analyse debtors balances in terms of debtors turn over and number of days sales in receivables.", "TD-AP-02"),
            proc("General", "Check the reasonableness of provision made for doubtful debts.", "TD-AP-03"),
            proc("General", "Prepare reconciliation of foreign and local Receivables with foreign and local sales.", "TD-AP-04")
          ],
          "Test of Controls": [
            proc("Invoices, receipt vouchers and credit notes", "Select four items each from invoices, receipt vouchers, and credit notes and verify that these are properly approved.", "TD-TOC-01"),
            proc("Invoices, receipt vouchers and credit notes", "Select four items each from invoices, receipt vouchers, and credit notes and verify that the posting is made in correct account.", "TD-TOC-02"),
            proc("Invoices, receipt vouchers and credit notes", "Select four items each from invoices, receipt vouchers, and credit notes and verify that these are posted in correct period.", "TD-TOC-03"),
            proc("General", "Check management keep record of ageing of debtors and take action on old outstanding balances.", "TD-TOC-04"),
            proc("General", "Check management circularize debtors and differences, if any, are investigated and reconciled.", "TD-TOC-05"),
            proc("General", "Subsidiary accounts of debtors are reconciled with g/l.", "TD-TOC-06"),
            proc("General", "Management keep record of provision for doubtful debts and makes adjustment in it at appropriate time. Write off of the debtors is approved at authorised Forum like BOD.", "TD-TOC-07")
          ],
          "Test of Details": [
            proc("Debtors Movement", "Obtain party-wise comparative schedule of debtors and agree opening balances with last year's working papers and g/l.", "TD-TOD-01"),
            proc("Debtors Movement", "Obtain party-wise comparative schedule of debtors and obtain age analysis and check ageing on test basis with relevant documents.", "TD-TOD-02"),
            proc("Debtors Movement", "Obtain party-wise comparative schedule of debtors and circularize major and old balances for direct confirmation. Summarise response and discuss with client for differences and no response balances. Obtain reconciliation for disputed balances and send reminders to non-confirmers.", "TD-TOD-03"),
            proc("Debtors Movement", "Obtain party-wise comparative schedule of debtors and check subsequent clearance of old outstanding, non-confirmers.", "TD-TOD-04"),
            proc("Debtors Movement", "Obtain party-wise comparative schedule of debtors and consider results of procedures above and suggest and discuss provision for doubtful debts with client.", "TD-TOD-05"),
            proc("Debtors Movement", "Obtain party-wise comparative schedule of debtors and check casting and cross casting of the schedule.", "TD-TOD-06"),
            proc("Ledgers",          "Select 3 accounts from debtors and perform for the whole year: check opening and closing balances with ledgers.", "TD-TOD-07"),
            proc("Ledgers",          "Select 3 accounts from debtors and perform for the whole year: check all debits and credits with source documents and ensure source documents relate to that debtor, are approved and posted in correct period.", "TD-TOD-08"),
            proc("General",          "Ensure disclosure requirements are properly met.", "TD-TOD-09")
          ]
        }
      },

      // ======================================================================
      // ADV  –  Advances, deposits, prepayments and other receivables
      // ======================================================================
      ADV: {
        title: "Advances, deposits, prepayments and other receivables",
        procedures: {
          "Analytical Procedures": [
            proc("General", "Compare current year balances and expense with last year balances and ensure that any significant variation should be properly and logically reasoned.", "ADV-AP-01")
          ],
          "Test of Controls": [],
          "Test of Details": [
            proc("Prepayments",       "Obtain itemized comparative detail of prepayments and agree opening and closing balances with g/l.", "ADV-TOD-01"),
            proc("Prepayments",       "Check adjustments of prepayments carried from previous year with the expense account of current year thereby ensuring that previous balances are made NIL.", "ADV-TOD-02"),
            proc("Prepayments",       "For prepayments arising during the year check with payment records and relevant documents showing period of validity of payment and calculate prepaid portion.", "ADV-TOD-03"),
            proc("Other Receivables", "Obtain itemized comparative schedule of other receivables and explain significant variation over previous year.", "ADV-TOD-04"),
            proc("Other Receivables", "Check proper subsidiary accounts are maintained and postings are made promptly in these accounts.", "ADV-TOD-05"),
            proc("Other Receivables", "All the items of receivables other than advances, deposits and prepayments and trade debts should be classified here.", "ADV-TOD-06"),
            proc("Other Receivables", "Document the nature of other receivables, check the movement with supporting documents and compute the amount of provision for doubtful receivables, if required.", "ADV-TOD-07"),
            proc("Other Receivables", "Determine that disclosures have been made in accordance with the requirements of the Companies Act, 2017 and the applicable IASs.", "ADV-TOD-08")
          ]
        }
      },

      // ======================================================================
      // CASH  –  Cash & Bank
      // ======================================================================
      CASH: {
        title: "Cash & Bank",
        procedures: {
          "Analytical Procedures": [
            proc("General", "Scan cash and bank books for large amount and unusual transactions.", "CASH-AP-01"),
            proc("General", "Compare current year balances with last year balances and ensure that any significant variation should be properly and logically reasoned.", "CASH-AP-02")
          ],
          "Test of Controls": [
            proc("General",              "Check that periodical reconciliation of bank statements with g/l are made, reviewed and approved by appropriate authority designated.", "CASH-TOC-01"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month and check that it is properly reviewed and approved.", "CASH-TOC-02"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month and agree book balance with g/l account and bank balance with bank statement.", "CASH-TOC-03"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month and check casting of reconciliation.", "CASH-TOC-04"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month and check un-cleared cheques and deposits in bank book and their clearance in bank statement subsequent to month end for which reconciliation is prepared.", "CASH-TOC-05"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month and check items that are not cleared in subsequent month bank statement, check their appearance in next month's bank reconciliation.", "CASH-TOC-06"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month and check un-recorded debits and credits in bank book, check their appearance in bank statement for the month and in bank book subsequent to month end for which reconciliation is made.", "CASH-TOC-07"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month and check items that are not cleared in subsequent month bank book, inquire about reason for not recording and check their appearance in next month's bank reconciliation.", "CASH-TOC-08"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month: long outstanding items should be discussed with client and appropriate action suggested for their reversal.", "CASH-TOC-09"),
            proc("Bank Reconciliations", "Obtain copies of reconciliations for all banks for one month: for reversal items check their impact on revenue, expenses, liabilities and assets. Ensure no account was inflated for window dressing.", "CASH-TOC-10"),
            proc("Bank Reconciliations", "For all banks agree book balances with bank statements either directly or through reconciliation. Check last month's reconciling items and their subsequent clearance. If some reversals are required, incorporate them at year end. More than six months old cheques require reversals.", "CASH-TOC-11"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and check its authorization.", "CASH-TOC-12"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and check invoice, bill or other document attached justifying payment.", "CASH-TOC-13"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and check the relevance of payment.", "CASH-TOC-14"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and check it is posted in correct account.", "CASH-TOC-15"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and check it is posted in correct period.", "CASH-TOC-16"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and check acknowledgement of recipient.", "CASH-TOC-17"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and check income tax deduction where applicable.", "CASH-TOC-18"),
            proc("Payment Vouchers",     "Select 15 vouchers each from cash and bank payments and ensure that disbursement or cheque issuance are made by person independent of goods and services receiving or issuing function.", "CASH-TOC-19"),
            proc("Receipt Vouchers",     "Select 30 receipts each from cash and bank and check authorization.", "CASH-TOC-20"),
            proc("Receipt Vouchers",     "Select 30 receipts each from cash and bank and check documents supporting receipts.", "CASH-TOC-21"),
            proc("Receipt Vouchers",     "Select 30 receipts each from cash and bank and check its posting in correct account.", "CASH-TOC-22"),
            proc("Receipt Vouchers",     "Select 30 receipts each from cash and bank and check its posting in correct period.", "CASH-TOC-23"),
            proc("Receipt Vouchers",     "Select 30 receipts each from cash and bank and check the posting of receipt in cash or bank book and in bank statement.", "CASH-TOC-24"),
            proc("General",              "Check that cash in hand and in transit are properly insured.", "CASH-TOC-25"),
            proc("General",              "Check that cash book is periodically reviewed and checked by appropriate level of authority.", "CASH-TOC-26")
          ],
          "Test of Details": [
            proc("General", "Attend physical cash count at year end.", "CASH-TOD-01"),
            proc("General", "Obtain last document numbers of cash and bank receipts and payment vouchers.", "CASH-TOD-02"),
            proc("General", "Circularise all banks for direct confirmation and check all account balances confirmed by bank have been included in client's record.", "CASH-TOD-03"),
            proc("General", "Circularise all banks for direct confirmation and check all bank accounts are in company's name.", "CASH-TOD-04"),
            proc("General", "Circularise all banks for direct confirmation and check any encumbrance/lien reported on any account by bank is properly disclosed.", "CASH-TOD-05"),
            proc("General", "Obtain a list of cheque signatories and ensure they are properly authorized by BOD.", "CASH-TOD-06"),
            proc("General", "Ensure that cash receiving and paying function and access to related documents is restricted to authorized persons only.", "CASH-TOD-07"),
            proc("General", "Perform sequential test of cash and bank payment and receipt vouchers.", "CASH-TOD-08"),
            proc("General", "Check that the FCY accounts have been converted into PKR applicable at year-end rate.", "CASH-TOD-09"),
            proc("General", "Ensure proper disclosure as per company law and IAS.", "CASH-TOD-10")
          ]
        }
      },

      // ======================================================================
      // CAL  –  Creditors, accrued and other liabilities
      // FIX: CAL-TOC-04 previously had wrong prefix "PAY-TOC-04" — corrected.
      // ======================================================================
      CAL: {
        title: "Creditors, accrued and other liabilities",
        procedures: {
          "Analytical Procedures": [
            proc("General", "Compare creditors, accrued liabilities, purchases and expenses with prior period and budgets, if any, and seek explanation for significant variances.", "CAL-AP-01"),
            proc("General", "Analyse ratio of trade creditors to purchases and compare with previous year and inquire about any significant variation. Where trade creditors include payables other than raw material, include these other costs also to purchases to calculate correct ratio.", "CAL-AP-02"),
            proc("General", "Analyse ratio of total payables (creditors, accrued and other liabilities other than income and sales taxes, security deposits and accrued financial charges) to total operating costs minus depreciation, taxes and financial costs. Compare this ratio with prior year and seek explanation for significant variances.", "CAL-AP-03"),
            proc("General", "Review all payable accounts for large and unusual transactions and inquire about their nature.", "CAL-AP-04")
          ],
          "Test of Controls": [
            proc("Schedules of Creditors and Other liabilities", "Obtain schedules of Creditors and Other liabilities (other than accrued expenses). On selected parties check that the liability is recorded on the basis of duly checked and approved invoices.", "CAL-TOC-01"),
            proc("Schedules of Creditors and Other liabilities", "Obtain schedules of Creditors and Other liabilities (other than accrued expenses). On selected parties check that the recording of liability is made in correct period.", "CAL-TOC-02"),
            proc("Schedules of Creditors and Other liabilities", "Obtain schedules of Creditors and Other liabilities (other than accrued expenses). On selected parties check that payments to creditors/accrued liabilities are made as per company's credit policy and after obtaining appropriate approval to release payment. Deduction of tax at source made as per law.", "CAL-TOC-03"),
            proc("General", "Check that the opening balance of accrued expenses was made nil during the year.", "CAL-TOC-04")
          ],
          "Test of Details": [
            proc("Party wise schedules", "Obtain party wise schedules of creditors and other liabilities (excluding accrued expenses) and trace opening balances to last year working papers.", "CAL-TOD-01"),
            proc("Party wise schedules", "Obtain party wise schedules of creditors and other liabilities (excluding accrued expenses) and, on test basis, check payments are made on proper approvals that are supported by bills/invoices.", "CAL-TOD-02"),
            proc("Party wise schedules", "Obtain party wise schedules of creditors and other liabilities (excluding accrued expenses) and, on test basis, trace payments made in bank statement/cash book and acknowledgement of recipients.", "CAL-TOD-03"),
            proc("Party wise schedules", "Obtain party wise schedules of creditors and other liabilities (excluding accrued expenses) and check proper tax deduction from payments as required by Income Tax Ordinance, 2001 are made.", "CAL-TOD-04"),
            proc("Party wise schedules", "Obtain party wise schedules of creditors and other liabilities (excluding accrued expenses) and select few debit notes raised and check these are properly authorized and posted in correct account.", "CAL-TOD-05"),
            proc("Party wise schedules", "Obtain party wise schedules of creditors and other liabilities (excluding accrued expenses) and check subsequent payment of all balances with special emphasis on old outstanding and stuck up balances. If there is no movement inquire about their genuineness or the reason otherwise.", "CAL-TOD-06"),
            proc("General", "Segregate debit balances in creditors and other liabilities. Inquire about their being in debit balance and classify them either as advances to suppliers or other receivables depending on the nature.", "CAL-TOD-07"),
            proc("General", "Circularise major and long outstanding balances and compare replies received with the amounts recorded in books. Seek explanation and obtain reconciliation in case of difference. Send reminders to non-respondents.", "CAL-TOD-08"),
            proc("General", "Ensure proper disclosure requirements have been taken care of.", "CAL-TOD-09")
          ]
        }
      },

      // ======================================================================
      // REV  –  Revenue
      // ======================================================================
      REV: {
        title: "Revenue",
        procedures: {
          "Analytical Procedures": [
            proc("Export Sales", "Check reasonableness of sales in relation to export realization during the year.", "REV-AP-01")
          ],
          "Test of Controls": [
            proc("Sales Transactions", "Make a selection of sales transactions from independent source record i.e. sales invoices, allocation slip, packing list, customers purchase orders and check that corresponding sales are recorded in sales ledger and vice versa to ensure completeness.", "REV-TOC-01"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check with invoice hard copy.", "REV-TOC-02"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check invoice is properly approved and authorized.", "REV-TOC-03"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check rates charged are as per company's approved price list or other approved rates.", "REV-TOC-04"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check quantity and quality (description) of product with purchase order of customer.", "REV-TOC-05"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check the quantity and quality (description) of products with allocation slip/packing list duly approved.", "REV-TOC-06"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check its posting in correct customer account.", "REV-TOC-07"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check it is posted in correct period.", "REV-TOC-08"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check the recovery against invoice with receipt voucher.", "REV-TOC-09"),
            proc("Sales Transactions", "Make a selection of sales transactions from sales ledger and check discount, if any, allowed is duly approved.", "REV-TOC-10"),
            proc("General",           "Check sales invoices preparation and recording functions are independent of order receiving and delivery of goods function.", "REV-TOC-11"),
            proc("General",           "Check that invoices, allocation slips/packing list and credit notes are preferably pre-numbered. Check their numerical sequence.", "REV-TOC-12"),
            proc("Credit Notes",      "Select a sample of credit notes and ensure it is approved at appropriate level.", "REV-TOC-13"),
            proc("Credit Notes",      "Select a sample of credit notes and trace returned goods through allocation slip reference and entry in stock ledger and trace their disposal till the end or valuation in the closing stock.", "REV-TOC-14"),
            proc("Credit Notes",      "Select a sample of credit notes and check if there is any related complaint with the goods returned and ensure it is properly followed up.", "REV-TOC-15"),
            proc("Credit Notes",      "Select a sample of credit notes and check return of goods is properly documented on receiving document and inspection report of planning and quality departments is annexed.", "REV-TOC-16"),
            proc("Credit Notes",      "Select a sample of credit notes and trace posting in sales ledger or sales return account.", "REV-TOC-17"),
            proc("Credit Notes",      "Select a sample of credit notes and trace posting of credit note in correct customer account.", "REV-TOC-18")
          ],
          "Test of Details": [
            proc("General", "Select sales invoices, allocation slip/packing list shortly before and after year end and apply cut-off test to ensure proper recording of revenue.", "REV-TOD-01"),
            proc("General", "Check export sales with L/Cs, bills of lading, packing list, GDs and Form E and its posting into correct customer ledger, sales ledger and correct period.", "REV-TOD-02"),
            proc("General", "Check that export invoices are properly priced and approved.", "REV-TOD-03"),
            proc("General", "Rebate claims, if any, on export sales are prepared, approved and lodged in correct period.", "REV-TOD-04"),
            proc("General", "Check that accounting policy and method of revenue recognition is proper and applied consistently.", "REV-TOD-05"),
            proc("General", "Calculate exchange differences on export sales and check their recognition.", "REV-TOD-06"),
            proc("General", "To cover volume and value, perform test of control #2 above as test of detail.", "REV-TOD-07"),
            proc("General", "Determine that disclosures have been made in accordance with the requirement of Companies Act, 2017 and relevant accounting pronouncements.", "REV-TOD-08")
          ]
        }
      },

      // ======================================================================
      // OC  –  Operating Cost - Overall
      // ======================================================================
      OC: {
        title: "Operating Cost - Overall",
        procedures: {
          "Analytical Procedures": [
            proc("General", "Compare actual expense with budgets where applicable and check it is reviewed and analysed by authorized person.", "OC-AP-01"),
            proc("General", "Compare expense with prior period and explain variance.", "OC-AP-02")
          ],
          "Test of Controls": [],
          "Test of Details": [
            proc("Sample from each head of account", "Select a sample from each head of account and check the relevance of expense.", "OC-TOD-01"),
            proc("Sample from each head of account", "Select a sample from each head of account and check approval by appropriate authority.", "OC-TOD-02"),
            proc("Sample from each head of account", "Select a sample from each head of account and check expense is supported by evidence i.e. bill, invoice etc.", "OC-TOD-03"),
            proc("Sample from each head of account", "Select a sample from each head of account and check payment is made through cash/cheque as per company policy.", "OC-TOD-04"),
            proc("Sample from each head of account", "Select a sample from each head of account and check expense is posted in correct account head.", "OC-TOD-05"),
            proc("Sample from each head of account", "Select a sample from each head of account and check expense is recorded in correct period.", "OC-TOD-06"),
            proc("Sample from each head of account", "Select a sample from each head of account and check income tax deduction is made as per law.", "OC-TOD-07"),
            proc("Sample from each head of account", "Select a sample from each head of account and ensure expense is not of a capital nature.", "OC-TOD-08"),
            proc("General", "For recurring expenses ensure it is recorded for the whole year and any prepayment/accrual is segregated.", "OC-TOD-09"),
            proc("General", "Agree balance with g/l.", "OC-TOD-10"),
            proc("General", "Scan general ledger of expenses and investigate large and unusual items, whether these expenses were incurred for the purposes of the business.", "OC-TOD-11"),
            proc("General", "Determine that disclosures have been in accordance with the requirements of Companies Act 2017 and relevant accounting pronouncements.", "OC-TOD-12")
          ]
        }
      },

      // ======================================================================
      // PAY  –  Operating Cost - Payroll
      // FIX #1: This area was outside the `areas` object — now correctly inside.
      // FIX #2: First four procedures all had duplicate ID "PAY-TOD-01".
      //         Now correctly sequenced PAY-TOD-01 through PAY-TOD-04.
      // ======================================================================
      PAY: {
        title: "Operating Cost - Payroll",
        procedures: {
          "Analytical Procedures": [],
          "Test of Controls":      [],
          "Test of Details": [
            proc("General",             "Check that attendance register and/or attendance cards are maintained and reviewed by responsible and authorized person.", "PAY-TOD-01"),
            proc("General",             "Check that staff and workers are designated as to their work and salaries and wages are classified as to their nature i.e. salaries and wages are classified as per cost centers/departments created in company and are summarized and charged to production, admin and selling function according to their incurrence in relevant section.", "PAY-TOD-02"),
            proc("General",             "Check that payroll is approved by an authorized person.", "PAY-TOD-03"),
            proc("General",             "Check total payroll expense with G/L.", "PAY-TOD-04"),
            proc("Permanent employees", "Select a sample of two months (one from each half year) from permanent employees and check salary, allowances and deductions with personal files.", "PAY-TOD-05"),
            proc("Permanent employees", "Select a sample of two months (one from each half year) from permanent employees and check mathematical accuracy of gross and net pay.", "PAY-TOD-06"),
            proc("Permanent employees", "Select a sample of two months (one from each half year) from permanent employees and check acknowledgement of receipt of cash/cheque for salary.", "PAY-TOD-07"),
            proc("Permanent employees", "Select a sample of two months (one from each half year) from permanent employees and check income tax deduction is made as per law if applicable.", "PAY-TOD-08"),
            proc("Permanent employees", "Select a sample of two months (one from each half year) from permanent employees and check the existence of employees where possible during audit visits.", "PAY-TOD-09"),
            proc("Permanent employees", "Select a sample of two months (one from each half year) from permanent employees and check unpaid salaries are recorded separately and subsequently cleared.", "PAY-TOD-10"),
            proc("Permanent employees", "Select a sample of two months (one from each half year) from permanent employees and check overtime payments, if any, are made as per rules of company.", "PAY-TOD-11"),
            proc("Temporary workers",   "Select a sample of temporary workers and check appointment letter and ensure it is approved.", "PAY-TOD-12"),
            proc("Temporary workers",   "Select a sample of temporary workers and agree number of days/hours worked with attendance record.", "PAY-TOD-13"),
            proc("Temporary workers",   "Select a sample of temporary workers and calculate computation of wages.", "PAY-TOD-14"),
            proc("Temporary workers",   "Select a sample of temporary workers and check acknowledgement of receipt of wages.", "PAY-TOD-15"),
            proc("Temporary workers",   "Select a sample of temporary workers and check unpaid wages are recorded separately.", "PAY-TOD-16"),
            proc("Temporary workers",   "Select a sample of temporary workers and check overtime payment is made as per rules.", "PAY-TOD-17"),
            proc("Temporary workers",   "Select a sample of temporary workers and ensure physical existence where possible.", "PAY-TOD-18"),
            proc("New joiners",         "Select few joiners from all categories and check there was requisition duly approved by departmental head for new employment.", "PAY-TOD-19"),
            proc("New joiners",         "Select few joiners from all categories and check there is an appointment letter duly approved.", "PAY-TOD-20"),
            proc("New joiners",         "Select few joiners from all categories and trace entry into payroll of the month in which appointment was made.", "PAY-TOD-21"),
            proc("New joiners",         "Select few joiners from all categories and agree salary with appointment letter.", "PAY-TOD-22"),
            proc("Leavers",             "Select few leavers during the year and check termination/resignation or service completion letter duly approved.", "PAY-TOD-23"),
            proc("Leavers",             "Select few leavers during the year and check deletion from attendance record.", "PAY-TOD-24"),
            proc("Leavers",             "Select few leavers during the year and check deletion from salary register.", "PAY-TOD-25"),
            proc("Leavers",             "Select few leavers during the year and check computation of final settlement and its payment. Check it is approved by authorized person.", "PAY-TOD-26")
          ]
        }
      },

      // ======================================================================
      // TAX  –  Taxation
      // FIX: Was outside the `areas` object — now correctly inside.
      // ======================================================================
      TAX: {
        title: "Taxation",
        procedures: {
          "Analytical Procedures": [
            proc("Tax Expense Comparison",     "Compare the current year's tax expense with prior years and industry benchmarks to identify unusual fluctuations.", "TAX-AP-01"),
            proc("Tax Expense Comparison",     "Investigate significant variances that may indicate misstatements or incorrect tax provisions.", "TAX-AP-02"),
            proc("Effective Tax Rate Analysis","Calculate the effective tax rate (Tax Expense ÷ Profit Before Tax) and compare it with the applicable statutory tax rate.", "TAX-AP-03"),
            proc("Effective Tax Rate Analysis","Identify inconsistencies that may indicate unrecognized tax liabilities or errors in tax calculations.", "TAX-AP-04"),
            proc("Deferred Tax Trend Review",  "Analyze movements in deferred tax assets and liabilities over multiple periods.", "TAX-AP-05"),
            proc("Deferred Tax Trend Review",  "Assess whether deferred tax is appropriately recognized based on applicable accounting standards and tax regulations.", "TAX-AP-06")
          ],
          "Test of Controls": [
            proc("Tax Compliance Policy Review",     "Review the entity's internal policies for tax compliance, including corporate tax, withholding tax, and indirect tax processes.", "TAX-TOC-01"),
            proc("Tax Compliance Policy Review",     "Assess whether the policies align with tax laws and regulatory requirements.", "TAX-TOC-02"),
            proc("Walkthrough of Tax Filing Process","Trace a sample of tax calculations and returns from initiation to filing.", "TAX-TOC-03"),
            proc("Walkthrough of Tax Filing Process","Verify whether the entity follows a structured process for tax determination, recording, and reporting.", "TAX-TOC-04"),
            proc("Tax Payment Authorization",        "Assess the approval process for tax payments to ensure proper authorization and compliance.", "TAX-TOC-05"),
            proc("Tax Payment Authorization",        "Verify that tax payments are made timely and in accordance with applicable tax regulations.", "TAX-TOC-06")
          ],
          "Test of Details": [
            proc("Tax Payment & Filing Verification","Inspect tax payments made and reconcile them with tax returns filed with tax authorities.", "TAX-TOD-01"),
            proc("Tax Payment & Filing Verification","Confirm that payments align with reported tax liabilities in financial statements.", "TAX-TOD-02"),
            proc("Tax Balance Reconciliation",       "Reconcile tax balances (current tax, deferred tax) with supporting tax computations, general ledger, and financial statements.", "TAX-TOD-03"),
            proc("Tax Balance Reconciliation",       "Ensure that tax liabilities and assets are accurately recorded and classified.", "TAX-TOD-04"),
            proc("Tax Notices & Assessments Review", "Examine tax assessments, notices, and correspondence with tax authorities to identify potential liabilities or disputes.", "TAX-TOD-05"),
            proc("Tax Notices & Assessments Review", "Assess whether adequate provisions are made for any tax contingencies.", "TAX-TOD-06"),
            proc("Deferred Tax Examination",         "Verify the recognition and measurement of deferred tax assets and liabilities.", "TAX-TOD-07"),
            proc("Deferred Tax Examination",         "Assess whether deferred tax positions comply with relevant accounting standards (e.g., IAS 12 – Income Taxes).", "TAX-TOD-08")
          ]
        }
      },

      // ======================================================================
      // RP  –  Related Party Transactions
      // FIX: Was outside the `areas` object — now correctly inside.
      // ======================================================================
      RP: {
        title: "Related Party Transactions",
        procedures: {
          "Analytical Procedures": [
            proc("Compare Financial Ratios",   "Compare financial ratios involving related party transactions with industry benchmarks or prior periods.", "RP-AP-01"),
            proc("Review Trends",              "Review trends in related party transactions and balances over multiple periods.", "RP-AP-02"),
            proc("Budget vs. Actual Analysis", "Compare actual related party transactions with budgets/forecasts, focusing on significant deviations.", "RP-AP-03")
          ],
          "Test of Controls": [
            proc("Review Internal Controls Documentation","Examine internal control policies for identifying and disclosing related party transactions.", "RP-TOC-01"),
            proc("Walkthrough Testing",                   "Perform walkthrough testing to trace selected related party transactions through the accounting system.", "RP-TOC-02"),
            proc("Interview Key Personnel",               "Interview management regarding the approval and monitoring process of related party transactions.", "RP-TOC-03")
          ],
          "Test of Details": [
            proc("Confirmation of Balances", "Obtain written confirmation from related parties for balances and transactions.", "RP-TOD-01"),
            proc("Reconciliation",           "Reconcile related party balances with agreements or contracts.", "RP-TOD-02"),
            proc("Subsequent Events Review", "Review subsequent events to identify any additional related party transactions requiring disclosure.", "RP-TOD-03")
          ]
        }
      }

    } // ← end areas
  };
})();
