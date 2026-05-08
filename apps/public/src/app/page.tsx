import type { Metadata } from "next";
import { getCurrentFeaturedSetWithMessagesCached } from "@/data/queries";
import { TerminalFrame } from "@/components/TerminalFrame";
import { LogRow } from "@/components/LogRow";
import { formatLastLogin } from "@/lib/format";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "NullDiary",
  description: "Confessions from the machine.",
  openGraph: {
    title: "NullDiary",
    description: "Confessions from the machine.",
    url: "/",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "NullDiary — Confessions from the machine.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NullDiary",
    description: "Confessions from the machine.",
    images: ["/og"],
  },
};

export default async function HomePage() {
  let featured: Awaited<
    ReturnType<typeof getCurrentFeaturedSetWithMessagesCached>
  > = null;

  try {
    featured = await getCurrentFeaturedSetWithMessagesCached();
  } catch {
    featured = null;
  }

  const messages = featured?.messages ?? [];
  const lastLogin = formatLastLogin(new Date());

  return (
    <TerminalFrame title="~/nulldiary — confessions.log">
      <div className="login-line">Last login: {lastLogin} on ttys003</div>
      <div className="banner-row">
        <span className="banner">∅ tail -f /var/log/confessions</span>
        <span className="nav-link">
          [<a href="/about">man nulldiary</a>]
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="term-empty">
          <div className="line">tail: /var/log/confessions: file is empty</div>
          <div className="line">
            waiting for input… <span className="cursor" />
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg) => {
            const href = msg.short_id
              ? `/m/${msg.short_id}`
              : `/messages/${msg.id}`;
            return <LogRow key={msg.id} message={msg} href={href} />;
          })}
          <div className="log-row" aria-hidden>
            <span className="ts" />
            <span className="who" />
            <span className="msg">
              <span className="cursor" />
            </span>
          </div>
        </>
      )}
    </TerminalFrame>
  );
}
