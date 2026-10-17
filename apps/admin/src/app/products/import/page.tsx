"use client";

import { buildCategoryTree, type CategoryNode, type ProductImportResult, type ProductImportRow } from "@ration/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, Card, Select, Spinner, Table } from "@/components/ui";
import { admin, describeError, qk } from "@/lib/api";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { useAuth } from "@/stores/auth";

const COLUMNS = ["slug", "name", "brand", "subcategories", "unit_label", "mrp", "price", "tax_rate", "description", "image_url", "image_credit", "is_veg", "tags", "orderable", "active", "stock"] as const;
const REQUIRED = ["name", "subcategories", "unit_label", "mrp", "price"] as const;
const BATCH = 200;
const TAX = new Set([0, 5, 12, 18, 28, 40]);

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const yesNo = (v: string, fallback: boolean | null): boolean | null => {
  const t = v.trim().toLowerCase();
  if (!t) return fallback;
  if (["yes", "y", "true", "1", "veg"].includes(t)) return true;
  if (["no", "n", "false", "0", "non-veg", "nonveg"].includes(t)) return false;
  return undefined as unknown as null; // flagged by the caller
};
const paise = (v: string) => {
  const n = Number(v.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

interface Parsed {
  rows: ProductImportRow[];
  problems: { row: number; message: string }[];
}

/** Turns CSV text into import rows, checking everything that can be checked without the database. */
const parse = (text: string, shelves: Set<string>): Parsed => {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], problems: [{ row: 1, message: "The file has no product rows." }] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], problems: [{ row: 1, message: `Missing column(s): ${missing.join(", ")}. Download the template for the exact headers.` }] };
  const col = (r: string[], name: string) => (header.indexOf(name) >= 0 ? (r[header.indexOf(name)] ?? "").trim() : "");
  const rows: ProductImportRow[] = [];
  const problems: Parsed["problems"] = [];
  const slugs = new Set<string>();
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const bad = (m: string) => problems.push({ row: line, message: m });
    const name = col(r, "name");
    const unit = col(r, "unit_label");
    const subs = col(r, "subcategories").split("|").map((s) => s.trim()).filter(Boolean);
    const mrp = paise(col(r, "mrp"));
    const price = paise(col(r, "price"));
    const tax = col(r, "tax_rate") ? Number(col(r, "tax_rate")) : 0;
    const stockText = col(r, "stock");
    const stock = stockText === "" ? null : Number(stockText);
    const isVeg = yesNo(col(r, "is_veg"), null);
    const orderable = yesNo(col(r, "orderable"), true);
    const active = yesNo(col(r, "active"), true);
    const slug = col(r, "slug") ? slugify(col(r, "slug")) : slugify(`${name} ${unit}`);
    const before = problems.length;
    if (!name) bad("name is empty");
    if (!unit) bad("unit_label is empty");
    if (!subs.length) bad("subcategories is empty");
    for (const s of subs) if (!shelves.has(s)) bad(`unknown subcategory "${s}" (see the subcategory list)`);
    if (!Number.isFinite(mrp) || mrp <= 0) bad("mrp must be a positive amount in rupees");
    if (!Number.isFinite(price) || price <= 0) bad("price must be a positive amount in rupees");
    else if (price > mrp) bad("price is above mrp");
    if (!TAX.has(tax)) bad("tax_rate must be one of 0, 5, 12, 18, 28, 40");
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) bad("stock must be a whole number, 0 or more");
    if (isVeg === undefined || orderable === undefined || active === undefined) bad("is_veg, orderable and active take yes or no");
    if (slugs.has(slug)) bad(`duplicate product "${slug}" in this file`);
    slugs.add(slug);
    if (problems.length > before) return;
    rows.push({
      row: line, slug, name, brand: col(r, "brand") || null, subcategories: subs, unit_label: unit, mrp, price, tax_rate: tax,
      description: col(r, "description") || null, image_url: col(r, "image_url") || null, image_credit: col(r, "image_credit") || null,
      is_veg: isVeg, tags: col(r, "tags").split("|").map((t) => t.trim().toLowerCase()).filter(Boolean),
      orderable: orderable ?? true, is_active: active ?? true, stock,
    });
  });
  return { rows, problems };
};

const shelvesOf = (tree: CategoryNode[]) => tree.flatMap((d) => d.children.flatMap((c) => c.children.map((s) => ({ dept: d.name, category: c.name, shelf: s }))));

export default function ProductImportPage() {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: qk.categories, queryFn: admin.categories.list });
  const stores = useQuery({ queryKey: qk.stores, queryFn: admin.stores.list });
  const globalStore = useAuth((s) => s.storeId);
  const [storeId, setStoreId] = useState<string>("");
  const effectiveStore = storeId || globalStore || stores.data?.[0]?.id || "";
  const tree = useMemo(() => buildCategoryTree((categories.data ?? []).map((c) => ({ ...c, icon: null, description: null }))), [categories.data]);
  const shelves = useMemo(() => shelvesOf(tree), [tree]);
  const shelfSlugs = useMemo(() => new Set(shelves.map((s) => s.shelf.slug)), [shelves]);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    setResult(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    setParsed(parse(await file.text(), shelfSlugs));
  };

  const run = async () => {
    if (!parsed?.rows.length) return;
    setError(null);
    const total = parsed.rows.length;
    const sum: ProductImportResult = { created: 0, updated: 0, brands_created: 0, errors: [] };
    try {
      for (let i = 0; i < total; i += BATCH) {
        setProgress({ done: i, total });
        const r = await admin.products.import(parsed.rows.slice(i, i + BATCH), effectiveStore || null);
        sum.created += r.created;
        sum.updated += r.updated;
        sum.brands_created += r.brands_created;
        sum.errors.push(...r.errors);
      }
      setProgress({ done: total, total });
      setResult(sum);
      void qc.invalidateQueries();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const template = () =>
    downloadCsv("ration-products-template.csv", [
      [...COLUMNS],
      ["", "Aashirvaad Whole Wheat Atta", "Aashirvaad", "atta-rice-dal-atta", "5 kg", "295", "279", "5", "Whole wheat flour for soft everyday rotis.", "https://example.com/atta.jpg", "Photo: Aashirvaad", "yes", "atta|gehu atta", "yes", "yes", "40"],
      ["amul-butter-100g", "Amul Butter", "Amul", "dairy-bread-eggs-cheese-butter", "100 g", "60", "58", "12", "Salted table butter for toast and cooking.", "", "", "yes", "butter|makhan", "yes", "yes", ""],
    ]);
  const shelfList = () => downloadCsv("ration-subcategories.csv", [["subcategory_slug", "department", "category", "subcategory"], ...shelves.map((s) => [s.shelf.slug, s.dept, s.category, s.shelf.name])]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Import products</h1>
          <p className="text-sm text-muted">Create or update many products at once from a CSV file (Excel: File &gt; Save As &gt; CSV UTF-8).</p>
        </div>
        <Link href="/products" className="text-sm font-semibold text-primary">Back to products</Link>
      </div>

      <Card title="1. Prepare your file">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li><b>Required:</b> name, subcategories, unit_label, mrp, price. Amounts are in rupees.</li>
          <li><b>subcategories:</b> one or more subcategory slugs separated by <code>|</code>. The first is the main shelf; the product appears on all of them.</li>
          <li><b>slug</b> identifies the product. Leave it empty to build one from name and unit; re-importing the same slug updates that product.</li>
          <li><b>brand</b> is matched by name; new brands are created. <b>tags</b> are separated by <code>|</code>. is_veg, orderable and active take yes or no.</li>
          <li><b>stock</b> sets the quantity at the store chosen below; leave it empty to keep current stock. image_credit is required when the image licence asks for attribution.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={template}>Download template</Button>
          <Button variant="secondary" onClick={shelfList} disabled={!shelves.length}>Download subcategory list ({shelves.length})</Button>
        </div>
      </Card>

      <Card title="2. Upload">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">CSV file</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="text-sm" disabled={categories.isLoading} />
          </label>
          <Select label="Stock goes to store" value={effectiveStore} onChange={(e) => setStoreId(e.target.value)}>
            {(stores.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </Select>
        </div>
        {categories.isLoading ? <div className="mt-3"><Spinner /></div> : null}
        {parsed ? (
          <div className="mt-4 space-y-3 text-sm">
            <p><b>{fileName}:</b> {parsed.rows.length} row(s) ready{parsed.problems.length ? `, ${parsed.problems.length} problem(s) to fix (those rows are skipped)` : ""}.</p>
            {parsed.problems.length ? (
              <Table head={["Line", "Problem"]}>
                {parsed.problems.slice(0, 100).map((p, i) => <tr key={i}><td className="px-3 py-1.5">{p.row}</td><td className="px-3 py-1.5 text-danger">{p.message}</td></tr>)}
              </Table>
            ) : null}
            {parsed.rows.length ? (
              <Table head={["Line", "Product", "Brand", "Main shelf", "Unit", "MRP", "Price", "Stock"]}>
                {parsed.rows.slice(0, 15).map((r) => (
                  <tr key={r.row}>
                    <td className="px-3 py-1.5">{r.row}</td><td className="px-3 py-1.5">{r.name}</td><td className="px-3 py-1.5">{r.brand ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.subcategories[0]}{r.subcategories.length > 1 ? ` +${r.subcategories.length - 1}` : ""}</td><td className="px-3 py-1.5">{r.unit_label}</td>
                    <td className="px-3 py-1.5">₹{(r.mrp / 100).toFixed(2)}</td><td className="px-3 py-1.5">₹{(r.price / 100).toFixed(2)}</td><td className="px-3 py-1.5">{r.stock ?? "unchanged"}</td>
                  </tr>
                ))}
              </Table>
            ) : null}
            {parsed.rows.length > 15 ? <p className="text-muted">Showing the first 15 rows.</p> : null}
            <Button onClick={() => void run()} disabled={!parsed.rows.length || !!(progress && progress.done < progress.total)} loading={!!progress && progress.done < progress.total}>
              Import {parsed.rows.length} product(s)
            </Button>
            {progress ? <p className="text-muted">{progress.done < progress.total ? `Importing… ${progress.done} of ${progress.total}` : "Finished."}</p> : null}
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>

      {result ? (
        <Card title="3. Result">
          <p className="text-sm"><b>{result.created}</b> created, <b>{result.updated}</b> updated, <b>{result.brands_created}</b> new brand(s).{result.errors.length ? ` ${result.errors.length} row(s) were rejected by the database:` : " No errors."}</p>
          {result.errors.length ? (
            <div className="mt-3">
              <Table head={["Line", "Reason"]}>
                {result.errors.map((e, i) => <tr key={i}><td className="px-3 py-1.5">{e.row}</td><td className="px-3 py-1.5 text-danger">{e.message}</td></tr>)}
              </Table>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
