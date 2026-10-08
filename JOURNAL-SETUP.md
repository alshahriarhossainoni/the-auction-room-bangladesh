# TAR Private Trading Journal — Phase 1

1. In your existing Supabase project, open SQL Editor and run `journal-schema.sql` **once**. This enables row-level security and restricts trade records to the designated owner user UUID. If policies already exist from a previous attempt, do not blindly rerun; review first.
2. Upload the entire contents of this ZIP into your existing GitHub Pages repository root, retaining CNAME and the existing Supabase config.
3. Sign in as the owner and open `journal.html` or use **My Trading Journal** in Account Dashboard.
4. Export **closed trade history** to CSV from your trading platform. Import and check the preview, especially commissions, swaps, timezone and whether P&L is gross or net. Importing the same tickets again updates records rather than duplicating them.
5. This importer accepts comma-delimited CSV with column names such as Ticket/Deal/Order, Symbol, Type, Close Time/Time, Profit/Net Profit, Commission, Swap. It does NOT support native HTML/XLSX MT5 reports or automatically reconcile complex partial fills. If your Exness export format differs, share a sample with account identifiers redacted so a dedicated mapping can be added.

## Privacy and future sync
- Do not put trading passwords, service-role keys or the generated secret token in public website files or GitHub.
- Data is stored in Supabase under authenticated user ID, with RLS policies. Only the configured owner ID can read/write it. The webpage itself is public but journal data is private.
- Cloud auto-sync is **not included** in Phase 1; future server-side bridge should write the same table with a secure server-side credential.
- Journal calculations use the imported net P&L and account currency; calendar groups by the CSV timestamp interpreted as UTC for date-time strings without timezone.
