import Link from "next/link";
export function Policy({ kind }: { kind: "privacy" | "terms" | "community" }) {
  return (
    <article className="container legal">
      <p className="eyebrow">A CIRCLE BUILT ON TRUST</p>
      {kind === "terms" ? (
        <>
          <h1>Membership, clearly.</h1>
          <p>
            Ambro Connects is a network by Ambro and Mandarin Roots. It helps
            Global members discover and connect with China professionals and
            other Global members who choose to appear in the directory.
          </p>
          <h2>Choose your membership</h2>
          <ul>
            <li>
              Ambro Connect China: RMB 1,000 for 12 months, with profile review
              and payment confirmation.
            </li>
            <li>
              Ambro Connect Global: RMB 100 for one month, with manual payment
              confirmation.
            </li>
            <li>
              Eligible Mandarin Roots trips with Ambro include 12 months of
              Global membership after the team verifies your booking. The
              complimentary year is available once per member.
            </li>
          </ul>
          <h2>How activation works</h2>
          <p>
            Creating an account or submitting a reference does not activate a
            membership. Your account shows each request and its approval status.
            Access starts after approval. A renewal extends your existing
            period; the end date is visible in My space.
          </p>
          <p>
            No payments are collected on this website at launch. No card is
            stored and there is no automatic debit or automatic paid renewal.
            Confirm the payment instructions, eligible trip conditions and any
            cancellation or refund arrangements directly with Mandarin Roots
            before sending money.
          </p>
          <h2>Connections and business</h2>
          <p>
            Membership gives access to the network; it does not guarantee
            enquiries, sales, travel, visas or business outcomes. A reviewed
            profile means the team reviewed the application. Achievements and
            portfolio stories are supplied by the member. Agree on scope,
            credentials, pricing and delivery directly before doing business.
          </p>
          <p>
            Only Global members can send requests, to visible China or Global
            members. China members can browse profiles and respond to requests.
            China-to-China requests are not available. Contact email is shared
            with the other member only after a connection is accepted with both
            members’ consent. Connection requests, acceptance and completion are
            recorded. Eligible completed connections may receive one moderated
            review.
          </p>
          <h2>Keeping the circle useful</h2>
          <p>
            Profiles must be honest, respectful and based on work you may share.
            The team can reject or suspend a profile, membership or review that
            breaches the <Link href="/community">community guidelines</Link>.
            Edits to China profiles and published Global profiles return them to
            review before they are listed again. Demo profiles are fictional
            previews, clearly labeled, and cannot receive real requests.
          </p>
          <div className="status">
            Launch information: confirm operator support details and payment
            arrangements with Mandarin Roots before making a payment.
          </div>
        </>
      ) : kind === "privacy" ? (
        <>
          <h1>Your information. Your circle.</h1>
          <p>
            This notice explains how this first version of Ambro Connects
            handles the information you provide.
          </p>
          <h2>What we collect</h2>
          <p>
            Your account email, encrypted authentication credentials managed by
            Supabase, membership type, profile details and optional images. We
            also store membership references and notes, approval decisions,
            connection introductions, consent records and reviews. Do not upload
            passports, identity documents, bank cards or confidential client
            material to your profile.
          </p>
          <h2>What other people can see</h2>
          <p>
            Approved, active China profiles are publicly discoverable. Names,
            city, company, biography, specialties, languages, achievements,
            portfolio and approved reviews may be visible. Global profiles are
            listed only when the member turns on public network visibility,
            after profile approval and membership activation. Existing Global
            profiles remain unlisted unless their owner opts in. People involved
            in a connection can see each other’s basic profile and introduction.
          </p>
          <p>
            Profile images and portfolio images use public image links, even
            while a profile awaits review. Only upload images you intend to
            share publicly and have permission to use. Public content may be
            copied by its viewers.
          </p>
          <h2>What stays private</h2>
          <p>
            Your membership reference, payment or trip notes, and approval
            history are available to you and authorized administrators. Your
            email is not in the directory. It becomes available to the other
            party on an accepted connection, with consent from both people.
            Phone numbers and WhatsApp contact links are not displayed in the
            directory or public profiles. Do not put contact details in public
            text or images.
          </p>
          <h2>How the app works</h2>
          <p>
            Supabase provides authentication, database and image storage for
            this app in a separate project from Mandarin Roots staff operations.
            Vercel hosts the website. Essential session cookies keep you signed
            in. Saved profile IDs are stored in your browser on this device;
            clearing browser storage removes those saves. This release does not
            install advertising trackers.
          </p>
          <h2>Your choices</h2>
          <p>
            You can edit your profile and photos in{" "}
            <Link href="/account">My space</Link>. Global members can turn off
            public network visibility there. Edits to China or published Global
            profiles return them for review. You can choose whether to send or
            accept a connection and share your email. Contact the Mandarin Roots
            team through your existing booking or membership channel for access,
            removal, visibility or other privacy requests. Do not send sensitive
            information in public profile fields.
          </p>
          <div className="status">
            Launch information: a dedicated support channel and detailed
            retention policy must be confirmed before broad public onboarding.
          </div>
        </>
      ) : (
        <>
          <h1>Good people. A good circle.</h1>
          <p>A useful network starts with how we treat one another.</p>
          <h2>Be yourself, accurately</h2>
          <p>
            Use your real professional identity. Share work, qualifications and
            achievements honestly. Only upload photos and client work you have
            permission to publish. Payment alone is not verification of
            professional credentials.
          </p>
          <h2>Start with a thoughtful hello</h2>
          <p>
            Keep connection requests relevant to the person’s work. Explain what
            you need, where and when. Respect a declined request. Do not use
            introductions for spam, harassment or unrelated promotions.
          </p>
          <h2>Respect what is shared</h2>
          <p>
            Use a connection’s email only for the purpose you discussed. Do not
            resell contacts, publish private messages or circulate other
            members’ personal information.
          </p>
          <h2>Leave fair, useful reviews</h2>
          <p>
            Review your own completed connections. Describe your experience
            honestly and respectfully. Reviews are checked before publication.
            Do not post fabricated feedback or use reviews to threaten another
            member.
          </p>
          <h2>Take care before doing business</h2>
          <p>
            Discuss scope, pricing, qualifications and delivery directly. A
            membership, profile review or rating does not guarantee results.
            Avoid sharing sensitive documents until you understand who needs
            them and why.
          </p>
          <h2>When something goes wrong</h2>
          <p>
            Keep the relevant request or project reference and contact the
            Mandarin Roots team through your existing membership channel. The
            team can review profiles, moderate reviews and suspend accounts.
          </p>
        </>
      )}
    </article>
  );
}
