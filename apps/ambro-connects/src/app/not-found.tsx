import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container section">
      <div className="empty-state">
        <p className="eyebrow" style={{ justifyContent: "center" }}>
          A SMALL DETOUR
        </p>
        <h1 style={{ fontSize: 36, marginTop: 15 }}>Let’s reconnect.</h1>
        <p>
          We couldn’t find this page. Your next connection is waiting somewhere
          else.
        </p>
        <Link href="/discover" className="btn btn-dark">
          Explore the network ↗
        </Link>
      </div>
    </div>
  );
}
