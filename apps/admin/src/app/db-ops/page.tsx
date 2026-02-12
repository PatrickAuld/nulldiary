import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { deleteMessagesByStatusOlderThan } from "@/data/db-ops";

export const dynamic = "force-dynamic";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default async function DbOpsPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string;
    status?: string;
    olderThan?: string;
  }>;
}) {
  const sp = await searchParams;

  const deleted = sp.deleted ? Number(sp.deleted) : null;
  const resultStatus = sp.status ?? null;
  const olderThan = sp.olderThan ?? null;

  async function deleteOldMessages(formData: FormData) {
    "use server";

    const status = String(formData.get("status") ?? "").trim();
    const daysStr = String(formData.get("days") ?? "").trim();
    const confirm = String(formData.get("confirm") ?? "").trim();

    if (confirm !== "DELETE") {
      throw new Error('Confirmation required. Type "DELETE".');
    }

    const days = Number(daysStr);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error("Days must be a positive number");
    }

    if (status !== "pending" && status !== "approved" && status !== "denied") {
      throw new Error("Invalid status");
    }

    const olderThanIso = isoDaysAgo(days);

    const db = getDb();
    const res = await deleteMessagesByStatusOlderThan(db, status, olderThanIso);

    redirect(
      `/db-ops?deleted=${encodeURIComponent(String(res.deleted))}` +
        `&status=${encodeURIComponent(status)}` +
        `&olderThan=${encodeURIComponent(olderThanIso)}`,
    );
  }

  return (
    <div>
      <h1>DB operations</h1>
      <p>
        Dangerous tools. Use carefully. These operations run with service-role
        DB access.
      </p>

      {typeof deleted === "number" && !Number.isNaN(deleted) && (
        <div className="detail-section">
          <h2>Last operation</h2>
          <p>
            Deleted <strong>{deleted}</strong> message(s)
            {resultStatus ? (
              <>
                {" "}
                with status <code>{resultStatus}</code>
              </>
            ) : null}
            {olderThan ? (
              <>
                {" "}
                older than <code>{olderThan}</code>
              </>
            ) : null}
            .
          </p>
        </div>
      )}

      <div className="detail-section">
        <h2>Delete messages by status older than N days</h2>
        <form action={deleteOldMessages}>
          <div className="filters">
            <div>
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="pending">
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="denied">denied</option>
              </select>
            </div>
            <div>
              <label htmlFor="days">Older than (days)</label>
              <input id="days" name="days" type="number" defaultValue={30} />
            </div>
            <div>
              <label htmlFor="confirm">Type DELETE to confirm</label>
              <input id="confirm" name="confirm" placeholder="DELETE" />
            </div>
            <div>
              <button type="submit">Delete</button>
            </div>
          </div>
        </form>

        <p style={{ marginTop: 12 }}>
          Tip: start with <code>pending</code> and a high day count (e.g. 90).
        </p>
      </div>
    </div>
  );
}
