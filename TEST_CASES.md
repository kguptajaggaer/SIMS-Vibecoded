# SIMS Test Cases

**App URL (local):** http://localhost:3000  
**App URL (Vercel):** https://sims-vibecoded.vercel.app  
**Admin credentials:** admin@usps.gov / Admin@123  
**All seeded users:** same password Admin@123

---

## 1. Authentication

### TC-AUTH-01 — Internal Admin Login
- Go to `/login`
- Enter `admin@usps.gov` / `Admin@123`
- **Expected:** Redirected to internal dashboard

### TC-AUTH-02 — Internal User Login (non-admin role)
- Go to `/login`
- Enter `james.co@usps.gov` / `Admin@123`
- **Expected:** Redirected to internal dashboard with CO role access

### TC-AUTH-03 — Supplier User Login
- Go to `/supplier/login`
- Enter `john.doe@acmefederal.com` / `Admin@123`
- **Expected:** Redirected to supplier portal

### TC-AUTH-04 — Wrong Password
- Go to `/login`
- Enter `admin@usps.gov` / `WrongPassword`
- **Expected:** Error message shown, no redirect

### TC-AUTH-05 — Forgot Password (Internal)
- Go to `/forgot-password`
- Enter `james.co@usps.gov`
- **Expected:** Success message; email sent to that address via SendGrid

### TC-AUTH-06 — Forgot Password (Supplier)
- Go to `/forgot-password`
- Enter `john.doe@acmefederal.com`
- **Expected:** Success message; email sent with supplier login link

### TC-AUTH-07 — Forgot Password (Non-existent Email)
- Go to `/forgot-password`
- Enter `nobody@example.com`
- **Expected:** Same success message (no email enumeration)

### TC-AUTH-08 — Logout
- Log in as any user
- Click logout
- **Expected:** Redirected to login page; back button does not re-enter session

---

## 2. Supplier Management (Internal)

### TC-SUPP-01 — View Supplier List
- Log in as admin
- Navigate to **Suppliers**
- **Expected:** Grid shows 23 seeded suppliers with Name, APEX, Email, Status columns

### TC-SUPP-02 — Search / Filter Suppliers
- In Suppliers list, type "BlueStar" in search
- **Expected:** Only BlueStar Technologies visible

### TC-SUPP-03 — Create Supplier (All Fields)
- Click **Add Supplier**
- Fill: Name=Test Corp, APEX=APX-99001, Email=test@testcorp.com, Phone=555-000-0001, Address/City/State/Zip, Status=Active, Diverse=Yes, Classifications=[Small Business]
- Click Save
- **Expected:** Supplier appears in list; email column shows test@testcorp.com

### TC-SUPP-04 — Create Supplier (No Email)
- Click **Add Supplier**
- Fill Name, APEX only
- Click Save
- **Expected:** Supplier created without email; no invite auto-sent

### TC-SUPP-05 — Auto-Invite on Supplier Creation with Email
- Create a new supplier with a valid email
- **Expected:** Invite email sent automatically via SendGrid; supplier status flips to Active

### TC-SUPP-06 — Manual Invite Button
- Find Acme Federal Solutions (has email set)
- Click **✉ Invite** button
- **Expected:** Invite email sent; temp password generated; supplier can now log in at `/supplier/login`

### TC-SUPP-07 — Edit Supplier
- Click edit on Meridian Office Supplies
- Change city to "Annapolis"
- Click Save
- **Expected:** Updated city visible in list and edit form

### TC-SUPP-08 — View Supplier Detail
- Click on Supplier name in list
- **Expected:** Detail page shows all fields including diversity classifications

### TC-SUPP-09 — Diversity Filter
- Filter by "Diverse = Yes"
- **Expected:** Only suppliers with `is_diverse=true` shown (Meridian, GreenPath, Apex Printing, Sunrise, Mountain Peak, SkyHigh, EcoWise, Sterling)

### TC-SUPP-10 — Status Filter
- Filter by Status = Prospective
- **Expected:** Coastal Courier, Mountain Peak, Rapid Response, SkyHigh shown

---

## 3. Internal User Management

### TC-USER-01 — View Internal Users
- Log in as admin, navigate to **Users**
- **Expected:** Seeded internal users listed (12 users covering all roles)

### TC-USER-02 — Create Internal User
- Click **Add User**, fill Name, Email, Username, Role = IBP Manager
- **Expected:** User created; appears in list with IBP Manager role

### TC-USER-03 — Edit User Role
- Edit James Williams, change role to Portfolio Manager
- **Expected:** Role updated; user sees PM-level menus on next login

### TC-USER-04 — Deactivate User
- Edit any non-admin user, set Active = No
- **Expected:** User cannot log in; shown as inactive in list

### TC-USER-05 — All Roles Covered
- Verify list includes one user each for: admin, co, portfolio_manager, diversity_manager, epp_admin, ibp_manager, cmc_manager, sr_manager, ap_reviewer
- **Expected:** All 9 roles present in seeded data

---

## 4. SubK Contract Management

### TC-SUBK-01 — View SubK Contract List
- Navigate to **Compliance > SubK**
- **Expected:** 12 SubK contracts and 5 SubK+EPP contracts listed

### TC-SUBK-02 — Supplier Search Autocomplete
- Click **Add Contract**
- In Supplier field, type "Blue"
- **Expected:** Dropdown shows BlueStar Technologies with APEX and email

### TC-SUBK-03 — Supplier Auto-Populate
- Select BlueStar from dropdown
- **Expected:** Supplier APEX, Name, Supplier Contact Email auto-filled

### TC-SUBK-04 — CO Search Autocomplete
- In Contract Officer field, type "Mar"
- **Expected:** Dropdown shows Maria Garcia (maria.co@usps.gov)

### TC-SUBK-05 — Create Full SubK Contract
- Fill all required fields: Supplier (search), CO (search), Commodity, Contract Amount, Subcontract Amount, Start/End dates, Report Type, MB/WB/SB % and $ goals, Portfolios, CMC, Comments
- Click Save
- **Expected:** Contract created with number USPS-SUBK-202X-XXX; appears in list

### TC-SUBK-06 — Validate PRD Fields Present
In contract create/edit form verify these fields exist:
- [ ] Supplier Contact (name)
- [ ] Supplier Contact Email
- [ ] Portfolios (multi-select)
- [ ] CMC
- [ ] Contract Amount
- [ ] Subcontract Amount
- [ ] Report Type (Quarterly / Semi-Annual / Annual)
- [ ] MB Goal % and $
- [ ] WB Goal % and $
- [ ] SB Goal % and $
- [ ] Comments

### TC-SUBK-07 — Document Attachments
- In contract create form, scroll to Attachments section
- Add description "Signed Contract" and pick a PDF for Slot 1
- Add description "SOW" and pick a PDF for Slot 2
- Click Save
- **Expected:** Contract saved; documents visible in contract detail

### TC-SUBK-08 — View Contract Detail
- Click on USPS-SUBK-2024-001 (Acme Federal Solutions)
- **Expected:** All fields shown including goals, CO, portfolios, attachments

### TC-SUBK-09 — Contract Status Workflow (CO Review)
- Open a cycle with status `ready_for_co_review`
- Click Approve or Reject
- **Expected:** Status advances; email notification sent to supplier

### TC-SUBK-10 — Contract Status Workflow (Portfolio Review)
- Open a cycle with status `ready_for_portfolio_review`
- **Expected:** PM user sees the cycle; can approve/reject

### TC-SUBK-11 — Contract Status Workflow (Diversity Review)
- Open a cycle with status `ready_for_diversity_review`
- **Expected:** Diversity Manager user sees cycle; can advance status

### TC-SUBK-12 — Supplier Reporting (Supplier Side)
- Log in as `john.doe@acmefederal.com` / Admin@123 (Acme supplier user)
- Navigate to active contracts
- **Expected:** USPS-SUBK-2024-001 visible; can enter spend data

---

## 5. EPP Contract Management

### TC-EPP-01 — View EPP Contract List
- Navigate to **Compliance > EPP**
- **Expected:** 8 EPP contracts listed (plus 5 SubK+EPP in SubK list)

### TC-EPP-02 — Create EPP Contract
- Click **Add EPP Contract**
- Supplier search: type "Eco", select EcoWise Supplies
- Fill commodity, amount, dates, CO
- **Expected:** EPP contract created without MB/WB/SB fields (EPP-only doesn't need goals)

### TC-EPP-03 — EPP Fields Match PRD
Verify these EPP-specific fields are present:
- [ ] Supplier (search autocomplete)
- [ ] CO (search autocomplete)
- [ ] Commodity / Description
- [ ] Contract Amount
- [ ] Start / Expiration dates
- [ ] Report Type
- [ ] EPP-specific compliance notes / comments
- [ ] Document attachments (5 slots)

### TC-EPP-04 — EPP Contract Status Flow
- Open EPP cycle for USPS-EPP-2024-001 (status: ready_for_co_review)
- Approve as CO user (david.park@usps.gov / Admin@123... wait, dpark@usps.gov)
- **Expected:** Status advances; email notification triggered

### TC-EPP-05 — EPP Contract Detail
- Click on USPS-EPP-2024-002 (GreenPath Environmental)
- **Expected:** All EPP fields shown including CO, dates, commodity

---

## 6. SubK + EPP Combined Contracts

### TC-BOTH-01 — View Combined Contracts
- In SubK list, look for contracts with type `subk_epp`
- **Expected:** 5 combined contracts visible (USPS-BOTH-2024-001 through 005)

### TC-BOTH-02 — Combined Contract Has Both Field Sets
- Open USPS-BOTH-2024-001
- **Expected:** Both SubK fields (MB/WB/SB goals, subcontract amount) and EPP fields present

---

## 7. Contract Cycle Workflow (End-to-End)

### TC-CYCLE-01 — New Contract → Open for Reporting
- Open a `new_contract` cycle (e.g., d0000004)
- Admin sets it to `open_for_reporting`
- **Expected:** Supplier sees "enter_spend_data" status; can submit report

### TC-CYCLE-02 — Supplier Submits Report
- Log in as supplier user linked to the contract
- Enter subcontracting spend data
- Submit
- **Expected:** Cycle status moves to `supplier_reported` / `ready_for_co_review`

### TC-CYCLE-03 — CO Approves
- Log in as james.co@usps.gov
- Find cycle in `ready_for_co_review`
- Click Approve
- **Expected:** Status advances; approval email sent

### TC-CYCLE-04 — CO Rejects
- Find another cycle in `ready_for_co_review`
- Click Reject with a reason
- **Expected:** Cycle back to `open_for_reporting`; rejection email sent to supplier

### TC-CYCLE-05 — Portfolio Manager Review
- Log in as rchen@usps.gov (Portfolio Manager)
- Find cycle in `ready_for_portfolio_review`
- Approve
- **Expected:** Moves toward `close_for_report` or next stage

### TC-CYCLE-06 — Close for Report
- Cycle in `close_for_report`
- Generate / finalize report
- **Expected:** Cycle moves to `closed`; final report generated

### TC-CYCLE-07 — Batch Approve
- As CO, select multiple cycles in `ready_for_co_review`
- Click Batch Approve
- **Expected:** All selected cycles advance; notifications sent per contract

---

## 8. Email Notifications

### TC-EMAIL-01 — Supplier Invite Email
- Create supplier with email or click Invite on existing supplier
- **Expected:** Email received at supplier email with login link and temp password

### TC-EMAIL-02 — Forgot Password Email (Internal)
- Submit `/forgot-password` for `rchen@usps.gov`
- **Expected:** Email has internal login link (`/login`)

### TC-EMAIL-03 — Forgot Password Email (Supplier)
- Submit `/forgot-password` for `george.tan@primeship.com`
- **Expected:** Email has supplier login link (`/supplier/login`)

### TC-EMAIL-04 — Contract Status Change Email
- Approve a contract cycle as CO
- **Expected:** Supplier contact receives status change notification

### TC-EMAIL-05 — Contract Rejection Email
- Reject a contract cycle
- **Expected:** Supplier receives rejection email with reason

### TC-EMAIL-06 — SendGrid Test Endpoint
```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"to":"kgupta904@gmail.com"}'
```
- **Expected:** `{"ok":true, "message":"Test email sent to ..."}`

---

## 9. Supplier Portal

### TC-PORTAL-01 — Supplier Login
- Go to `/supplier/login`
- Log in as `john.doe@acmefederal.com` / Admin@123
- **Expected:** Supplier dashboard shown; only Acme contracts visible

### TC-PORTAL-02 — Supplier Sees Own Contracts Only
- Log in as George Tan (`george.tan@primeship.com`)
- **Expected:** Only PrimeShip contracts (USPS-SUBK-2024-005) visible

### TC-PORTAL-03 — Supplier Updates Profile
- In supplier portal, edit profile/contact info
- **Expected:** Changes saved; visible to internal team

### TC-PORTAL-04 — Supplier Cannot See Other Suppliers' Data
- Log in as any supplier user
- Attempt to navigate to another supplier's contracts
- **Expected:** Access denied or data not returned

---

## 10. Supplier Performance & Scorecards

### TC-PERF-01 — View Supplier Performance
- Navigate to **Supplier Performance**
- **Expected:** List of suppliers with performance indicators

### TC-PERF-02 — Create Scorecard
- Select Acme Federal Solutions
- Fill in performance scores across categories
- **Expected:** Scorecard saved and associated with supplier

### TC-PERF-03 — Performance Review Scheduled Email
- Schedule a performance review for a supplier with email
- **Expected:** Notification email sent via SendGrid

### TC-PERF-04 — View Supplier Scorecard History
- View Acme's scorecard history
- **Expected:** Timeline of past assessments visible

---

## 11. Development Plans

### TC-DEV-01 — Create Development Plan
- Navigate to a supplier's detail page
- Add a Development Plan with action items and due dates
- **Expected:** Plan saved and linked to supplier

### TC-DEV-02 — Update Development Plan Status
- Mark an action item as Complete
- **Expected:** Status updated; visible to both internal team and supplier

---

## 12. Reporting & Dashboards

### TC-RPT-01 — SubK Spend Dashboard
- Navigate to **Reports > SubK**
- **Expected:** Spend data aggregated by supplier, goal vs. actual percentages

### TC-RPT-02 — EPP Compliance Report
- Navigate to **Reports > EPP**
- **Expected:** EPP contracts with compliance status

### TC-RPT-03 — Diversity Spend Summary
- Navigate to **Reports > Diversity**
- **Expected:** MB/WB/SB spend broken out by category; goal attainment %

### TC-RPT-04 — Export Report
- On any report, click Export (CSV or PDF)
- **Expected:** File downloaded with correct data

---

## 13. Role-Based Access Control

### TC-RBAC-01 — CO Cannot Access Admin Pages
- Log in as james.co@usps.gov
- Navigate to `/admin/users`
- **Expected:** Access denied or page not visible in nav

### TC-RBAC-02 — Diversity Manager Sees Diversity Module
- Log in as lthompson@usps.gov
- **Expected:** Diversity management module accessible

### TC-RBAC-03 — EPP Admin Sees EPP Module
- Log in as dpark@usps.gov
- **Expected:** EPP contracts module accessible; can approve EPP cycles

### TC-RBAC-04 — Supplier Cannot Access Internal Pages
- Log in as any supplier user
- Try navigating to `/suppliers` or `/compliance/subk/contracts`
- **Expected:** Access denied; redirected to supplier portal

### TC-RBAC-05 — Portfolio Manager Access
- Log in as rchen@usps.gov
- **Expected:** Portfolio review queue visible; can approve at PM stage

---

## 14. Data Integrity Checks

### TC-DATA-01 — Verify Seeded Suppliers Count
```sql
SELECT COUNT(*) FROM suppliers;
-- Expected: >= 23
```

### TC-DATA-02 — Verify Seeded Internal Users
```sql
SELECT name, role_id FROM users WHERE user_type='internal' ORDER BY name;
-- Expected: 12+ internal users
```

### TC-DATA-03 — Verify Supplier Users
```sql
SELECT COUNT(*) FROM users WHERE user_type='supplier';
-- Expected: >= 20
```

### TC-DATA-04 — Verify Contract Counts
```sql
SELECT contract_type, COUNT(*) FROM contracts GROUP BY contract_type;
-- Expected: subk=12, epp=8, subk_epp=5
```

### TC-DATA-05 — Verify Contract Cycles
```sql
SELECT COUNT(*) FROM contract_cycles;
-- Expected: 25 (one per contract)
```

### TC-DATA-06 — Verify Cycle Status Variety
```sql
SELECT status, COUNT(*) FROM contract_cycles GROUP BY status;
-- Expected: mix of new_contract, open_for_reporting, ready_for_co_review, ready_for_portfolio_review, ready_for_diversity_review, close_for_report, closed
```

---

## Seeded Test Accounts Reference

| Email | Password | Role | Notes |
|---|---|---|---|
| admin@usps.gov | Admin@123 | Admin | Existing admin |
| admin2@usps.gov | Admin@123 | Admin | Seeded second admin |
| james.co@usps.gov | Admin@123 | CO | Contract Officer |
| maria.co@usps.gov | Admin@123 | CO | Contract Officer |
| pmoore@usps.gov | Admin@123 | CO | Contract Officer |
| rchen@usps.gov | Admin@123 | Portfolio Manager | |
| lthompson@usps.gov | Admin@123 | Diversity Manager | |
| dpark@usps.gov | Admin@123 | EPP Admin | |
| jsmith.ibp@usps.gov | Admin@123 | IBP Manager | |
| mbrown@usps.gov | Admin@123 | CMC Manager | |
| awilson@usps.gov | Admin@123 | SR Manager | |
| kdavis@usps.gov | Admin@123 | AP Reviewer | |
| tanderson@usps.gov | Admin@123 | Portfolio Manager | |
| john.doe@acmefederal.com | Admin@123 | Supplier | Acme Federal |
| jane.smith@acmefederal.com | Admin@123 | Supplier | Acme Federal |
| mike.lee@bluestartech.com | Admin@123 | Supplier | BlueStar |
| george.tan@primeship.com | Admin@123 | Supplier | PrimeShip |
| carlos.vega@greenpath-env.com | Admin@123 | Supplier | GreenPath |
| evan.price@techvantage.com | Admin@123 | Supplier | TechVantage |
| ian.cox@apexprinting.com | Admin@123 | Supplier | Apex Printing |
| mark.diaz@sunrisefacility.com | Admin@123 | Supplier | Sunrise Facility |
| oscar.hunt@powergrid-elec.com | Admin@123 | Supplier | PowerGrid |
