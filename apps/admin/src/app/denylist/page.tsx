import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function normalizeNetwork(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("/")) return trimmed;

  // Host address
  if (trimmed.includes(":")) return `${trimmed}/128`;
  return `${trimmed}/32`;
}

export default async function DenylistPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; removed?: string; error?: string }>;
}) {
  const sp = await searchParams;

  const added = sp.added ? decodeURIComponent(sp.added) : null;
  const removed = sp.removed ? decodeURIComponent(sp.removed) : null;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  async function addNetwork(formData: FormData) {
    "use server";

    const raw = String(formData.get("network") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();

    if (!raw) {
      redirect(`/denylist?error=${encodeURIComponent("Network is required")}`);
    }

    const network = normalizeNetwork(raw);

    const db = getDb();
    const { error } = await db.from("ip_denylist").upsert({
      network,
      reason: reason || null,
    });

    if (error) {
      redirect(
        `/denylist?error=${encodeURIComponent(error.message ?? "Failed to add")}`,
      );
    }

    redirect(`/denylist?added=${encodeURIComponent(network)}`);
  }

  async function removeNetwork(formData: FormData) {
    "use server";

    const raw = String(formData.get("network") ?? "").trim();

    if (!raw) {
      redirect(`/denylist?error=${encodeURIComponent("Network is required")}`);
    }

    const network = normalizeNetwork(raw);

    const db = getDb();
    const { error } = await db
      .from("ip_denylist")
      .delete()
      .eq("network", network);

    if (error) {
      redirect(
        `/denylist?error=${encodeURIComponent(error.message ?? "Failed to remove")}`,
      );
    }

    redirect(`/denylist?removed=${encodeURIComponent(network)}`);
  }

  const db = getDb();
  const { data, error: listError } = await db
    .from("ip_denylist")
    .select("network, reason, created_at")
    .order("created_at", { ascending: false });

  if (listError) throw listError;

  const networks = (data ?? []) as Array<{
    network: string;
    reason: string | null;
    created_at: string;
  }>;

  return (
    <div>
      <h1>Denylist</h1>
      <p>
        Block abusive clients from submitting via <code>/s</code>. Entries
        accept single IPs (auto-normalized to <code>/32</code> or{" "}
        <code>/128</code>) or CIDR ranges.
      </p>

      {error && (
        <p className="error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      {added && (
        <p className="success" style={{ marginTop: 12 }}>
          Added <code>{added}</code>
        </p>
      )}
      {removed && (
        <p className="success" style={{ marginTop: 12 }}>
          Removed <code>{removed}</code>
        </p>
      )}

      <div className="detail-section">
        <h2>Add</h2>
        <form action={addNetwork}>
          <div className="filters">
            <div>
              <label htmlFor="network">IP or CIDR</label>
              <input
                id="network"
                name="network"
                placeholder="203.0.113.4 or 203.0.113.0/24 or 2001:db8::/64"
              />
            </div>
            <div>
              <label htmlFor="reason">Reason (optional)</label>
              <input id="reason" name="reason" placeholder="spam" />
            </div>
            <div>
              <button type="submit">Add</button>
            </div>
          </div>
        </form>
      </div>

      <div className="detail-section">
        <h2>Remove</h2>
        <form action={removeNetwork}>
          <div className="filters">
            <div>
              <label htmlFor="remove-network">IP or CIDR</label>
              <input
                id="remove-network"
                name="network"
                placeholder="203.0.113.4 or 203.0.113.0/24 or 2001:db8::/64"
              />
            </div>
            <div>
              <button type="submit">Remove</button>
            </div>
          </div>
        </form>
      </div>

      <div className="detail-section">
        <h2>Entries ({networks.length})</h2>
        {networks.length === 0 ? (
          <p>No entries.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Network</th>
                  <th>Reason</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((row) => (
                  <tr key={row.network}>
                    <td>
                      <code>{row.network}</code>
                    </td>
                    <td>{row.reason ?? ""}</td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
