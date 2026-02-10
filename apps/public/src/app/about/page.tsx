import { SiteHeader } from "@/components/SiteHeader";

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <div className="container">
        <h1 style={{ margin: "24px 0 10px", letterSpacing: "-0.02em" }}>
          NullDiary
        </h1>
        <p className="small">
          An anonymous diary of messages. The gallery is curated; the archive is
          the full approved set.
        </p>
        <p className="small">
          Images/textures and overlays are coming; for now, backgrounds are
          generated deterministically.
        </p>
      </div>
    </>
  );
}
