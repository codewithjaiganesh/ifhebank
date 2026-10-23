# IFHE Bank — Bank Branch Management System UI

Responsive front-end prototype branded for IFHE Bank. It is based on the uploaded Bank Branch Management System schema and uses plain HTML, CSS and vanilla JavaScript.

## Included
- IFHE Bank-branded login screen (demo interaction only)
- Overview dashboard with branch, employee, account and loan metrics
- Account balance trend chart and account portfolio visualization
- Branch directory with search
- Add-branch modal (session-only; no persistence)
- CSV export of visible branch directory rows
- Navigation for Branches, Employees, Customer Accounts, Loans and Reports
- Responsive mobile layout and toast notifications

## Run locally
1. Extract this ZIP.
2. Open the `ifhe-bank-management` folder in VS Code.
3. Open `index.html` in a browser, or use the VS Code Live Server extension.
4. Demo credentials are prefilled: `admin@ifhebank.demo` / `ifhebank123`.

## Push to GitHub
From the project folder terminal, run:

```bash
git add .
git commit -m "Rebrand branch management UI for IFHE Bank"
git push
```

These commands assume the folder is already connected to the correct GitHub remote.

## Backend-ready notes
The planned database entities follow the supplied schema: `BANK`, `BRANCH`, `EMPLOYEE`, `ACCOUNT`, and `LOAN`. Dashboard content is sample data. Login is not real authentication and newly added branches are not saved after refreshing the page. When adding the backend, connect forms and table data to secured API endpoints, use proper password hashing/session management, validate input server-side, and add role-based access control. This demo must not be used to store actual customer financial information.
