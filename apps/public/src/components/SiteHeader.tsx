export function SiteHeader() {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand">NullDiary</div>
        <nav className="nav" aria-label="Primary">
          <a href="/">Gallery</a>
          <a href="/archive">Archive</a>
          <a href="/about">About</a>
        </nav>
      </div>
    </header>
  );
}
