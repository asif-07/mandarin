import Link from "next/link";
import "./usage-guide.css";

export function UsageGuide() {
  return (
    <div className="container guide-page">
      <section className="guide-hero" aria-labelledby="guide-heading">
        <div>
          <span className="eyebrow">A little guidance. A good start.</span>
          <h1 id="guide-heading">
            Your way into
            <br />
            <em>the network.</em>
          </h1>
          <p className="guide-lead">
            Here to approve members, find a China expert or share your own
            experience? Start here.
          </p>
          <div className="guide-actions">
            <Link className="btn btn-primary" href="/login?next=/admin">
              Admin sign in <span aria-hidden="true">↗</span>
            </Link>
            <Link className="btn btn-ghost" href="/admin">
              Open approvals <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <aside
          className="guide-start-card"
          aria-label="Choose your starting point"
        >
          <span className="guide-small-label">
            One network. Two starting points.
          </span>
          <a href="#team">
            <span className="guide-start-icon" aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>I’m on the team</strong>
              <small>Access the dashboard & approve requests</small>
            </span>
            <span aria-hidden="true">↘</span>
          </a>
          <a href="#members">
            <span className="guide-start-icon" aria-hidden="true">
              ↗
            </span>
            <span>
              <strong>I’m joining the network</strong>
              <small>Set up a profile & make connections</small>
            </span>
            <span aria-hidden="true">↘</span>
          </a>
          <p>Keep this guide handy. Every step uses the same account.</p>
        </aside>
      </section>

      <nav className="guide-jump-nav" aria-label="In this guide">
        <a href="#team">01 / Team access</a>
        <a href="#approvals">02 / Approvals</a>
        <a href="#members">03 / Member guide</a>
        <a href="#connections">04 / Connections</a>
        <a href="#help">05 / Common questions</a>
      </nav>

      <section
        className="guide-section"
        id="team"
        aria-labelledby="team-heading"
      >
        <div className="guide-section-heading">
          <span className="eyebrow">01 / For the Mandarin Roots team</span>
          <h2 id="team-heading">Get into your admin portal.</h2>
          <p>
            Members and administrators use the same sign-in page. Your account’s
            team access unlocks the approval dashboard.
          </p>
        </div>
        <div className="guide-login-grid">
          <ol className="guide-steps">
            <li>
              <div>
                <h3>Create your designated team account.</h3>
                <p>
                  If you haven’t registered, open{" "}
                  <Link href="/join">Join the network</Link> with the email
                  designated for your admin access. Choose your own password and
                  confirm your email using the verification message.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Sign in with that email and password.</h3>
                <p>
                  There is no preset or shared admin password. Already
                  registered but can’t remember yours? Choose{" "}
                  <strong>Forgot your password?</strong> on the{" "}
                  <Link href="/login?next=/admin">sign-in page</Link>.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Open the team dashboard.</h3>
                <p>
                  Go to <Link href="/admin">Open approvals</Link>, or use{" "}
                  <strong>Team approvals</strong> in Profile or the navigation
                  menu. You’ll see the Memberships, Profiles and Reviews queues.
                </p>
              </div>
            </li>
          </ol>
          <aside className="guide-access-note">
            <span className="guide-note-symbol" aria-hidden="true">
              ↗
            </span>
            <h3>Team access is separate from membership.</h3>
            <p>
              You don’t need to pay a membership fee or activate a member plan
              to use the admin dashboard.
            </p>
            <p>
              If you see <strong>“This area is for the team”</strong>, you’re
              signed in, but that account has not been granted administrator
              access. Check the email you used, then ask the team owner to check
              your access.
            </p>
          </aside>
        </div>
      </section>

      <section
        className="guide-section"
        id="approvals"
        aria-labelledby="approvals-heading"
      >
        <div className="guide-section-heading">
          <span className="eyebrow">02 / The approval desk</span>
          <h2 id="approvals-heading">
            Three queues. One careful check at a time.
          </h2>
          <p>
            For a new member, check their profile first, then their membership
            request. These are two separate approvals.
          </p>
        </div>
        <div className="guide-review-grid">
          <article className="guide-review-card">
            <span className="guide-card-index">
              01 <span>/ Profiles</span>
            </span>
            <h3>Check the person & their work.</h3>
            <ul>
              <li>
                Open <strong>Profiles</strong> and read the introduction,
                business details, specialties, languages and previous work.
              </li>
              <li>
                A China profile needs a city, company, introduction and at least
                one specialty before approval.
              </li>
              <li>
                Choose <strong>Approve profile</strong> when the details are
                ready. Achievements are the member’s own statements; check
                anything you need to confirm.
              </li>
            </ul>
            <p className="guide-card-footnote">
              Profile approval alone does not activate membership.
            </p>
          </article>
          <article className="guide-review-card">
            <span className="guide-card-index">
              02 <span>/ Memberships</span>
            </span>
            <h3>Confirm the payment or trip.</h3>
            <ul>
              <li>
                Open <strong>Memberships</strong> and check the plan, submitted
                reference and member’s note.
              </li>
              <li>
                Match a payment reference to your own payment records, or a
                booking reference to a confirmed eligible Mandarin Roots trip.
              </li>
              <li>
                Choose <strong>Confirm payment & activate</strong> or{" "}
                <strong>Approve trip benefit</strong> only after you
                independently confirm it.
              </li>
            </ul>
            <p className="guide-card-footnote">
              Approval records the membership period. This website does not
              collect or transfer the payment.
            </p>
          </article>
          <article className="guide-review-card">
            <span className="guide-card-index">
              03 <span>/ Reviews</span>
            </span>
            <h3>Keep feedback useful & fair.</h3>
            <ul>
              <li>
                Open <strong>Reviews</strong> to read the rating and account of
                the member’s experience.
              </li>
              <li>
                Reviews can be submitted only by the Global member after their
                connection is marked completed.
              </li>
              <li>
                Approve suitable feedback to publish it. If it needs to be
                rejected, explain the issue in the review note.
              </li>
            </ul>
            <p className="guide-card-footnote">
              Pending reviews do not appear publicly or contribute to the public
              rating.
            </p>
          </article>
        </div>
        <div className="guide-two-gates">
          <div>
            <span className="eyebrow">When does a member profile go live?</span>
            <h3>
              Approved profile <span aria-hidden="true">+</span> active
              membership.
            </h3>
          </div>
          <p>
            Both are required for discovery and managing connection requests.
            Global members must also turn on public network visibility in My
            space. Editing a China or published Global profile returns it to
            profile review; its paid membership period remains recorded.
            Connection access pauses during profile review; hiding a pending
            Global profile does not restore access before approval.
          </p>
        </div>
        <details className="guide-disclosure">
          <summary>Something needs correcting. What should I do?</summary>
          <div>
            <p>
              Add a clear reason in <strong>Review note</strong>, then choose{" "}
              <strong>Reject</strong>. A reason is required. Explain exactly
              what is missing or could not be confirmed.
            </p>
            <p>
              For a rejected profile, the member can read the team’s note in My
              space, correct the details and save the profile to request another
              review. For a rejected membership request, they can read the
              reason under <strong>Recent requests</strong>, then submit a
              corrected reference.
            </p>
            <p>
              Use <strong>Refresh queue</strong> to check for new submissions.
              An empty queue means there are no pending items in that category.
            </p>
          </div>
        </details>
        <div
          className="guide-plan-grid"
          aria-label="Membership plans to verify"
        >
          <div>
            <span>Ambro Connect China</span>
            <strong>
              1,000 <small>RMB / year</small>
            </strong>
            <p>For people based in China doing business.</p>
          </div>
          <div>
            <span>Ambro Connect Global</span>
            <strong>
              100 <small>RMB / month</small>
            </strong>
            <p>For the global community connecting with China.</p>
          </div>
          <div>
            <span>Eligible Mandarin Roots trip</span>
            <strong>
              1 year <small>included</small>
            </strong>
            <p>
              A complimentary first year of Global membership, after booking
              approval.
            </p>
          </div>
        </div>
      </section>

      <section
        className="guide-section"
        id="members"
        aria-labelledby="members-heading"
      >
        <div className="guide-section-heading">
          <span className="eyebrow">03 / For the community</span>
          <h2 id="members-heading">Make your first introduction a good one.</h2>
          <p>
            Start with an account, then tell people who you are and what you’re
            here to do.
          </p>
        </div>
        <div className="guide-member-grid">
          <article className="guide-member-card">
            <span className="eyebrow">Ambro Connect China</span>
            <h3>You’re based in China.</h3>
            <ol>
              <li>Register as a China member and verify your email.</li>
              <li>
                Open <Link href="/account">Profile</Link>. Your name is already
                filled in. Use <strong>Edit profile</strong> to add your photo,
                city and company. Edit About, Work and Achievements from their
                own cards, then choose <strong>Save changes</strong>.
              </li>
              <li>
                Open the <strong>Membership</strong> tab and arrange the{" "}
                <strong>1,000 RMB yearly payment</strong> with Mandarin Roots.
                Enter its reference and choose{" "}
                <strong>Submit for approval</strong>.
              </li>
              <li>
                Once your profile is approved and membership is active, you can
                appear in discovery and respond to Global members’ connection
                requests.
              </li>
            </ol>
          </article>
          <article className="guide-member-card">
            <span className="eyebrow">Ambro Connect Global</span>
            <h3>You’re exploring China.</h3>
            <ol>
              <li>Register as a Global member and verify your email.</li>
              <li>
                Open <Link href="/account">Profile</Link> to see your profile.
                Your name is already filled in. Use{" "}
                <strong>Edit profile</strong> for your photo and city, then edit
                the About card to add your introduction and interests. Choose{" "}
                <strong>Save changes</strong> when ready.
              </li>
              <li>
                To receive requests, open{" "}
                <strong>Settings → Manage profile visibility</strong> and turn
                on <strong>Show my Global profile in the public network</strong>
                . Listing requires profile approval and active membership. Leave
                it off to browse and send requests without a public listing.
              </li>
              <li>
                In the <strong>Membership</strong> tab, choose{" "}
                <strong>100 RMB / month</strong>, or{" "}
                <strong>I’m joining an Ambro trip</strong> for the eligible
                complimentary year. Arrange payment or confirm your trip with
                Mandarin Roots.
              </li>
              <li>
                Submit the payment or booking reference for approval. When
                membership is active, browse{" "}
                <Link href="/discover">Discover</Link> and send a connection
                request.
              </li>
            </ol>
          </article>
        </div>
        <p className="guide-launch-note">
          <strong>Review release:</strong> We’re preparing email verification
          before opening registration to everyone. Team administrators can set
          up their designated account during this release.
        </p>
      </section>

      <section
        className="guide-section"
        id="connections"
        aria-labelledby="connections-heading"
      >
        <div className="guide-section-heading">
          <span className="eyebrow">04 / From hello to working together</span>
          <h2 id="connections-heading">How a connection works.</h2>
        </div>
        <ol className="guide-connection-flow">
          <li>
            <span aria-hidden="true">01</span>
            <h3>Find your person.</h3>
            <p>
              Members can browse China and visible Global profiles, photos,
              specialties, previous work and approved reviews in Discover.
            </p>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <h3>Send a thoughtful hello.</h3>
            <p>
              Open a profile and explain what you need. Give consent to share
              your account email if the request is accepted. Follow it in{" "}
              <Link href="/connections">Connections → Sent</Link>. Only Global
              members can send requests, to China or Global members.
              China-to-China requests are not available.
            </p>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <h3>Accept & talk directly.</h3>
            <p>
              The receiving member opens <strong>Connections → Received</strong>{" "}
              and can accept or decline. On acceptance, both members’ emails are
              shared with each other to arrange the work.
            </p>
          </li>
          <li>
            <span aria-hidden="true">04</span>
            <h3>Complete & share feedback.</h3>
            <p>
              After the work, the receiving member chooses{" "}
              <strong>Mark work completed</strong>. The Global member can then
              submit a rating and review for team moderation.
            </p>
          </li>
        </ol>
      </section>

      <section
        className="guide-section guide-help"
        id="help"
        aria-labelledby="help-heading"
      >
        <div className="guide-section-heading">
          <span className="eyebrow">05 / A few useful answers</span>
          <h2 id="help-heading">Still finding your way?</h2>
        </div>
        <details className="guide-disclosure">
          <summary>How do I remove the demo members later?</summary>
          <div>
            <p>
              Open the team dashboard. Under <strong>Preview data</strong>,
              choose <strong>Hide all demo profiles</strong>. This removes all
              sample profiles from the network together and leaves real member
              accounts unchanged. You can show them again while reviewing the
              design.
            </p>
            <p>
              Demo profiles are fictional examples with illustrated photos and
              sample work. They have no real ratings or contact details and
              cannot receive connection requests.
            </p>
          </div>
        </details>
        <details className="guide-disclosure">
          <summary>I registered. Why can’t I sign in yet?</summary>
          <div>
            <p>
              Confirm your email first, then sign in with the same email and the
              password you chose. Check your spam folder for the verification
              message. During the review release, wider registration is waiting
              for email delivery to be ready. If a verification or reset email
              does not arrive, contact Mandarin Roots.
            </p>
          </div>
        </details>
        <details className="guide-disclosure">
          <summary>Where can members see approval status?</summary>
          <div>
            <p>
              Open{" "}
              <Link href="/account?tab=membership">Profile → Membership</Link>.
              It shows the profile review status, whether membership is active
              and, after approval, the membership end date. A submitted
              reference shows as awaiting approval until the team makes a
              decision.
            </p>
          </div>
        </details>
        <details className="guide-disclosure">
          <summary>Is the monthly plan charged automatically?</summary>
          <div>
            <p>
              Payments are arranged directly with Mandarin Roots and reviewed
              manually. Submitting a reference or approving a membership does
              not charge a card, transfer money or set up automatic billing.
              Members can submit another verified payment reference to extend
              membership.
            </p>
          </div>
        </details>
        <details className="guide-disclosure">
          <summary>
            My China membership is paid. Why isn’t my profile visible?
          </summary>
          <div>
            <p>
              Your profile also needs team approval. Check its review status in
              Profile and read any team feedback. If you recently edited an
              approved profile, it returns to review and appears in discovery
              again after approval, provided your membership is still active.
            </p>
          </div>
        </details>
        <div className="guide-bottom-actions">
          <Link className="btn btn-dark" href="/login?next=/admin">
            Sign in to the team dashboard <span aria-hidden="true">↗</span>
          </Link>
          <Link className="guide-text-link" href="/account">
            Go to Profile <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
