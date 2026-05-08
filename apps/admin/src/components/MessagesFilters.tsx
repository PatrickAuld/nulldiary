"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Status = "pending" | "approved" | "denied";
type AutoFilter = "" | "any-auto" | "flagged" | "denied" | "human-only";

type Props = {
  status: Status;
  search: string;
  after: string;
  before: string;
  autoAction: AutoFilter;
};

const statuses: Status[] = ["pending", "approved", "denied"];

function buildQuery(params: {
  status: Status;
  search: string;
  after: string;
  before: string;
  autoAction: AutoFilter;
}): string {
  const sp = new URLSearchParams();

  if (params.status) sp.set("status", params.status);
  if (params.search.trim()) sp.set("search", params.search.trim());
  if (params.after) sp.set("after", params.after);
  if (params.before) sp.set("before", params.before);
  if (params.autoAction) sp.set("autoAction", params.autoAction);

  // Reset paging when filters change.
  sp.delete("offset");
  sp.delete("limit");

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function MessagesFilters(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(
    () => ({
      status: props.status,
      search: props.search,
      after: props.after,
      before: props.before,
      autoAction: props.autoAction,
    }),
    [props.after, props.before, props.search, props.status, props.autoAction],
  );

  const [status, setStatus] = useState<Status>(initial.status);
  const [search, setSearch] = useState<string>(initial.search);
  const [after, setAfter] = useState<string>(initial.after);
  const [before, setBefore] = useState<string>(initial.before);
  const [autoAction, setAutoAction] = useState<AutoFilter>(initial.autoAction);

  // Keep local UI in sync if navigation happens externally.
  useEffect(() => {
    setStatus(initial.status);
    setSearch(initial.search);
    setAfter(initial.after);
    setBefore(initial.before);
    setAutoAction(initial.autoAction);
  }, [initial]);

  const lastPushedRef = useRef<string>("");
  const searchDebounceRef = useRef<number | null>(null);

  function pushNext(next: {
    status: Status;
    search: string;
    after: string;
    before: string;
    autoAction: AutoFilter;
  }) {
    const qs = buildQuery(next);
    const url = `${pathname}${qs}`;

    if (url === lastPushedRef.current) return;

    // Avoid infinite loops.
    lastPushedRef.current = url;

    router.replace(url);
  }

  // When the URL changes (e.g. back button), allow future pushes.
  useEffect(() => {
    lastPushedRef.current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  }, [pathname, searchParams]);

  return (
    <div>
      <div className="status-tabs">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            className={`status-tabs__btn${s === status ? " status-tabs__btn--active" : ""}`}
            onClick={() => {
              setStatus(s);
              pushNext({ status: s, search, after, before, autoAction });
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <details className="filters-panel">
        <summary>Filters</summary>
        <form className="filters" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="search">Search</label>
            <input
              id="search"
              name="search"
              type="text"
              value={search}
              placeholder="Search content..."
              onChange={(e) => {
                const next = e.target.value;
                setSearch(next);

                if (searchDebounceRef.current) {
                  window.clearTimeout(searchDebounceRef.current);
                }

                searchDebounceRef.current = window.setTimeout(() => {
                  pushNext({ status, search: next, after, before, autoAction });
                }, 250);
              }}
            />
          </div>

          <div>
            <label htmlFor="after">After</label>
            <input
              id="after"
              name="after"
              type="date"
              value={after}
              onChange={(e) => {
                const next = e.target.value;
                setAfter(next);
                pushNext({ status, search, after: next, before, autoAction });
              }}
            />
          </div>

          <div>
            <label htmlFor="before">Before</label>
            <input
              id="before"
              name="before"
              type="date"
              value={before}
              onChange={(e) => {
                const next = e.target.value;
                setBefore(next);
                pushNext({ status, search, after, before: next, autoAction });
              }}
            />
          </div>

          <div>
            <label htmlFor="autoAction">Auto</label>
            <select
              id="autoAction"
              name="autoAction"
              value={autoAction}
              onChange={(e) => {
                const next = e.target.value as AutoFilter;
                setAutoAction(next);
                pushNext({ status, search, after, before, autoAction: next });
              }}
            >
              <option value="">Any</option>
              <option value="any-auto">Any auto-action</option>
              <option value="flagged">Flagged</option>
              <option value="denied">Auto-denied</option>
              <option value="human-only">Human-only (no auto)</option>
            </select>
          </div>
        </form>
      </details>
    </div>
  );
}
