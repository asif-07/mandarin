import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  MoveUpRight,
  Check,
  Globe2,
  ScanFace,
  Handshake,
  Search,
  Sparkles,
  Plane,
  ShieldCheck,
} from "lucide-react";
const ambroPortrait = "/brand/ambro-portrait.webp";
export default function Home() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> CHINA, THROUGH PEOPLE
          </p>
          <h1>
            Good people.
            <br />
            New possibilities.
            <br />
            <span>Your China circle.</span>
          </h1>
          <p className="hero-description">
            A little local knowledge. A shared ambition. Meet the people who
            make China feel a world closer.
          </p>
          <div className="hero-buttons">
            <Link href="/discover" className="btn btn-primary">
              Find your people <ArrowUpRight size={19} />
            </Link>
            <Link href="#memberships" className="text-link">
              Memberships <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-credit">
            <span className="credit-seal">
              <img src={ambroPortrait} alt="" width={40} height={40} />
            </span>
            <div>
              A network by <strong>Ambro</strong>
              <span>Hamras · Mandarin Roots</span>
            </div>
            <span className="credit-line" />
            <span className="credit-caption">
              Built on real connections.
              <br />
              Made for what’s next.
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo">
            <img
              src={ambroPortrait}
              alt="Hamras, known as Ambro, casually holding a coffee and phone on a tree-lined street"
              width={1100}
              height={1375}
              fetchPriority="high"
            />
            <div className="photo-shade" />
            <div className="photo-title">
              Meet Ambro.
              <br />
              <em>Your China connection.</em>
            </div>
            <span className="photo-number">HAMRAS · MANDARIN ROOTS</span>
          </div>
          <div className="floating-label">
            <span className="mini-icon">
              <Globe2 size={22} />
            </span>
            <div>
              Local roots.
              <br />
              <strong>Global connections.</strong>
            </div>
            <MoveUpRight size={21} />
          </div>
        </div>
      </section>
      <div className="community-strip">
        <div className="container">
          <span>ONE COMMUNITY. TWO WORLDS.</span>
          <p>
            People building in China <span>↔</span> People exploring China
          </p>
          <span className="strip-end">
            LET’S BRING THEM TOGETHER <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
      <section className="container section discover-teaser">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A CONNECTION FOR EVERY AMBITION</p>
            <h2>What brings you to China?</h2>
          </div>
          <Link href="/discover" className="text-link">
            Explore the network <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="category-grid">
          {[
            {
              n: "01",
              title: "Source something great.",
              text: "Sourcing & manufacturing",
              category: "Sourcing",
              icon: <Search />,
            },
            {
              n: "02",
              title: "Bridge the conversation.",
              text: "Translation & business support",
              category: "Translation",
              icon: <Handshake />,
            },
            {
              n: "03",
              title: "Make the journey count.",
              text: "Travel & local knowledge",
              category: "Travel",
              icon: <Plane />,
            },
            {
              n: "04",
              title: "Move your business forward.",
              text: "Logistics & trade",
              category: "Logistics",
              icon: <Globe2 />,
            },
          ].map((c) => (
            <Link
              className="category-card"
              key={c.n}
              href={`/discover?specialty=${c.category}`}
            >
              <div>
                <span>{c.n}</span>
                {c.icon}
              </div>
              <h3>{c.title}</h3>
              <p>
                {c.text}
                <ArrowUpRight size={18} />
              </p>
            </Link>
          ))}
        </div>
      </section>
      <section className="people-story container" id="how-it-works">
        <div className="story-art">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <div className="story-center">
            <img
              src="/brand/ambro-connects-symbol.png"
              alt=""
              width={80}
              height={80}
            />
          </div>
          <span className="orbit-pill pill1">
            <MapPin size={16} /> Based in China
          </span>
          <span className="orbit-pill pill2">
            <Globe2 size={16} /> Going places
          </span>
          <span className="orbit-pill pill3">
            <Handshake size={16} /> Something in common
          </span>
          <span className="art-caption">
            DISTANCE IS JUST THE STARTING POINT.
          </span>
        </div>
        <div className="story-copy">
          <p className="eyebrow">LESS GUESSWORK. MORE HUMAN.</p>
          <h2>
            Behind every opportunity,
            <br />
            there’s a person.
          </h2>
          <p>
            Go beyond a business card. Get to know someone’s work, experience
            and story before you start a conversation.
          </p>
          <ol className="steps">
            {[
              {
                t: "Find your people",
                d: "Explore by city, specialty and language.",
              },
              {
                t: "Get to know their work",
                d: "See profiles, achievements, project stories and member reviews.",
              },
              {
                t: "Make the first connection",
                d: "Send an introduction. Share contact details when you both say yes.",
              },
            ].map((s, i) => (
              <li key={s.t}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section
        className="container section membership-section"
        id="memberships"
      >
        <div className="center-heading">
          <p className="eyebrow">FIND YOUR PLACE IN THE CIRCLE</p>
          <h2>
            Two ways to belong.
            <br />
            One connected world.
          </h2>
          <p>
            Whether China is home or your next destination, there’s a place for
            you here.
          </p>
        </div>
        <div className="pricing-grid">
          <article className="pricing-card global-card">
            <div className="price-label">
              <span>
                <Globe2 size={18} /> FOR THE WORLD EXPLORERS
              </span>
              <span className="chip">Global</span>
            </div>
            <h3>
              Ambro Connect
              <br />
              <em>Global.</em>
            </h3>
            <p>
              Meet the people who know China.
              <br />
              Build connections before you even land.
            </p>
            <div className="price">
              100 <span>RMB / month</span>
            </div>
            <ul>
              {[
                "Discover China-based professionals",
                "Explore portfolios and member reviews",
                "Send personal connection requests",
                "Build your own China network",
              ].map((v) => (
                <li key={v}>
                  <Check size={17} />
                  {v}
                </li>
              ))}
            </ul>
            <Link href="/join?type=global" className="btn btn-dark">
              Join Global <ArrowUpRight size={18} />
            </Link>
            <div className="trip-benefit">
              <Plane size={22} />
              <p>
                <strong>Travelling with Ambro?</strong>
                <br />
                Your first 12 months are on us with an eligible Mandarin Roots
                trip, after booking verification.
              </p>
              <Link
                href="/join?type=global&plan=trip_year"
                aria-label="Claim trip membership benefit"
              >
                <ArrowUpRight size={20} />
              </Link>
            </div>
          </article>
          <article className="pricing-card china-card">
            <div className="price-label">
              <span>
                <MapPin size={18} /> FOR THE CHINA INSIDERS
              </span>
              <span className="chip">China</span>
            </div>
            <h3>
              Ambro Connect
              <br />
              <em>China.</em>
            </h3>
            <p>
              Be the connection someone’s looking for.
              <br />
              Open your business to a wider world.
            </p>
            <div className="price">
              1,000 <span>RMB / year</span>
            </div>
            <ul>
              {[
                "Your own professional member profile",
                "Showcase your work and achievements",
                "Meet visiting entrepreneurs and travellers",
                "Grow through meaningful introductions",
              ].map((v) => (
                <li key={v}>
                  <Check size={17} />
                  {v}
                </li>
              ))}
            </ul>
            <Link href="/join?type=china" className="btn btn-light">
              Join China <ArrowUpRight size={18} />
            </Link>
            <div className="china-footnote">
              <ShieldCheck size={20} />
              <p>
                For people who live and do business in China.
                <br />
                Profile review and payment confirmation required.
              </p>
            </div>
          </article>
        </div>
        <p className="pricing-note">
          Manual payment approval at launch. No payments are collected on this
          website. Membership begins after team confirmation.
        </p>
      </section>
      <section className="founder-band">
        <div className="container">
          <div>
            <p className="eyebrow">FROM A FAMILIAR FACE. TO A WIDER CIRCLE.</p>
            <h2>
              Ambro brings people together.
              <br />
              <em>Now there’s a place for it.</em>
            </h2>
            <p>
              Hamras, known as Ambro, connects people through travel and
              Mandarin Roots. Ambro Connects brings that spirit into a community
              that stays with you long after the trip.
            </p>
            <Link href="/join" className="text-link">
              Be part of the next chapter <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="founder-mark">
            <span>“</span>
            <p>
              The best thing you bring
              <br />
              back from a journey?
              <br />
              <em>The people.</em>
            </p>
            <span className="founder-signature">The Ambro Connects spirit</span>
          </div>
        </div>
      </section>
      <section className="container section faq-section">
        <div>
          <p className="eyebrow">A FEW THINGS, CONNECTED.</p>
          <h2>Before you say hello.</h2>
        </div>
        <div>
          {[
            {
              q: "Who can join Ambro Connects?",
              a: "Global membership is for people interested in visiting, travelling or doing business in China. China membership is for people who reside and do business in China and want to connect with visitors.",
            },
            {
              q: "How does the complimentary trip year work?",
              a: "Choose the trip benefit when you register and submit your Mandarin Roots booking reference. The team verifies your eligible Ambro trip before activating 12 months of Global membership. This does not automatically turn into a paid subscription.",
            },
            {
              q: "What does a reviewed profile mean?",
              a: "The team has reviewed the member’s application. It is not a guarantee of professional qualifications, business results or service quality. Portfolios and achievements are member provided; ratings come from completed connections and are moderated.",
            },
            {
              q: "How will I pay for membership?",
              a: "For launch, payments are handled manually. Submit a membership request in your account and the team will provide payment instructions. Access starts only when the team confirms payment or verifies your trip booking.",
            },
            {
              q: "When are my contact details shared?",
              a: "Your email is never shown in the public directory. Sending or accepting a connection includes consent to share your account email with that person once the request is accepted.",
            },
          ].map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span>+</span>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="container final-cta">
        <span className="cta-flower" aria-hidden="true">
          ✳
        </span>
        <div>
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS WITH A HELLO.</p>
          <h2>Make China feel closer.</h2>
        </div>
        <Link href="/join" className="btn btn-dark">
          Find your circle <ArrowUpRight size={19} />
        </Link>
      </section>
    </>
  );
}
