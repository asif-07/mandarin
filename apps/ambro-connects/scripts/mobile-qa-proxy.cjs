#!/usr/bin/env node
/* Local UI QA only. No credentials, database clients or production auth routes.
 * Start manually: node scripts/mobile-qa-proxy.cjs
 * A Next app server must already run on localhost:3010. For mobile QA prefer
 * production: run npm run build, then npm run start. npm run dev also serves
 * pages here, but dev HMR WebSocket upgrades are intentionally not proxied.
 * Open /__qa/admin, /__qa/global,
 * /__qa/china, /__qa/expired or /__qa/anonymous on http://127.0.0.1:3011.
 * Add ?reset=1 for fresh fixtures, &next=/connections for a different start page.
 * EVERY /api request is handled here; unsupported writes return 501. Incoming
 * cookies/authorization and upstream Set-Cookie are never forwarded.
 */
"use strict";
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const HOST = "127.0.0.1";
const PORT = 3011;
const UPSTREAM = { hostname: "127.0.0.1", port: 3010 };
const SCENARIOS = ["admin", "global", "china", "expired", "anonymous"];
const uid = (n) => `e0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const timestamp = (offset) =>
  new Date(Date.now() + offset * 86400000).toISOString();
const image = (id, kind = "avatar") => `/__qa/art/${id}/${kind}.svg`;
let state;
function initialState() {
  const actors = new Map();
  function actor(number, name, lane, extras = {}) {
    const id = uid(number);
    const profile = {
      id,
      full_name: `Local QA ${name}`,
      bio: "Fictional local UI QA profile. This content is held only in this proxy and never saved to the live app.",
      city: lane === "china" ? "Guangzhou" : "Dubai, UAE",
      company: "Local QA fictional company",
      specialties: [
        lane === "china" ? "Sourcing" : "Business services",
        "Travel",
      ],
      languages: ["English", "Mandarin"],
      avatar_url: image(id),
      cover_url: image(id, "cover"),
      achievements: [
        "Fictional QA portfolio milestone",
        "Local preview content only",
      ],
      portfolio: [
        {
          title: "Local QA project preview",
          description:
            "Fictional project to inspect mobile portfolio layout, spacing and image crops.",
          image_url: image(id, "project"),
        },
      ],
      created_at: timestamp(-45),
      updated_at: timestamp(-2),
      network_visible: lane === "global",
    };
    const plan = lane === "china" ? "china_yearly" : "global_monthly";
    const value = {
      user: {
        id,
        email: `local-qa-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.invalid`,
        is_admin: false,
      },
      profile,
      membership: {
        member_type: lane,
        preferred_plan: plan,
        moderation_status: "approved",
        moderation_reason: null,
        active: true,
        current: {
          id: uid(200 + number),
          plan,
          amount_rmb: lane === "china" ? 1000 : 100,
          starts_at: timestamp(-20),
          expires_at: timestamp(lane === "china" ? 345 : 10),
        },
        requests: [],
      },
    };
    if (extras.pending) {
      value.membership.moderation_status = "pending";
      value.membership.active = false;
      value.membership.current = null;
    }
    if (extras.expired) {
      value.membership.active = false;
      value.membership.current.expires_at = timestamp(-3);
      value.membership.current.starts_at = timestamp(-34);
      value.profile.network_visible = false;
    }
    if (extras.admin) {
      value.user.is_admin = true;
      value.profile.network_visible = false;
    }
    actors.set(id, value);
    return value;
  }
  actor(1, "Administrator", "global", { admin: true });
  const globalActor = actor(2, "Global Member", "global");
  globalActor.profile.avatar_url = "";
  globalActor.profile.cover_url = "";
  globalActor.profile.portfolio.forEach((item) => {
    item.image_url = "";
  });
  actor(3, "China Member", "china");
  actor(4, "Expired Member", "global", { expired: true });
  actor(5, "Global Partner", "global");
  actor(6, "Global Visitor", "global");
  actor(7, "China Logistics", "china");
  actor(8, "China Translator", "china");
  actor(9, "Pending China Applicant", "china", { pending: true });
  actor(10, "Pending Global Applicant", "global", { pending: true });
  actor(15, "Pending Trip Applicant", "global", { pending: true });
  const requests = [
    {
      id: uid(301),
      user_id: uid(9),
      plan: "china_yearly",
      reference: "LOCAL-QA-PAYMENT-ONLY",
      note: "Fictional payment note for mobile review. No payment has been made.",
      status: "pending",
      rejection_reason: null,
      created_at: timestamp(-2),
      reviewed_at: null,
    },
    {
      id: uid(302),
      user_id: uid(10),
      plan: "global_monthly",
      reference: "LOCAL-QA-GLOBAL-ONLY",
      note: "Fictional monthly membership application.",
      status: "pending",
      rejection_reason: null,
      created_at: timestamp(-1),
      reviewed_at: null,
    },
    {
      id: uid(303),
      user_id: uid(15),
      plan: "trip_year",
      reference: "LOCAL-QA-TRIP-ONLY",
      note: "Fictional trip reference. Inspect approval controls only.",
      status: "pending",
      rejection_reason: null,
      created_at: timestamp(-1),
      reviewed_at: null,
    },
  ];
  for (const request of requests)
    actors.get(request.user_id).membership.requests.push(request);
  const connections = [];
  function connection(number, sender, recipient, status) {
    connections.push({
      id: uid(number),
      sender_id: uid(sender),
      recipient_id: uid(recipient),
      message:
        "Local QA introduction: I am planning a business visit and would like to discuss sourcing, timing and the next steps. This is fictional local preview content.",
      status,
      created_at: timestamp(-8),
      updated_at: timestamp(-3),
      reviewed: false,
    });
  }
  connection(401, 5, 2, "pending");
  connection(402, 6, 2, "accepted");
  connection(403, 4, 2, "completed");
  connection(404, 2, 3, "pending");
  connection(405, 2, 5, "accepted");
  connection(406, 2, 7, "completed");
  connection(407, 5, 3, "accepted");
  connection(408, 6, 3, "completed");
  connection(409, 2, 8, "completed");
  const reviews = [
    {
      id: uid(501),
      connection_id: uid(406),
      reviewer_id: uid(2),
      recipient_id: uid(7),
      rating: 5,
      body: "Fictional local QA review. The planning was clear and the communication helpful. This preview is never published.",
      status: "pending",
      created_at: timestamp(-2),
      reviewer_name: actors.get(uid(2)).profile.full_name,
    },
    {
      id: uid(502),
      connection_id: uid(408),
      reviewer_id: uid(6),
      recipient_id: uid(3),
      rating: 4,
      body: "Another fictional local QA review to inspect the review moderation cards on small screens.",
      status: "pending",
      created_at: timestamp(-1),
      reviewer_name: actors.get(uid(6)).profile.full_name,
    },
  ];
  const demos = [11, 12, 13, 14].map((number, index) => ({
    ...structuredClone(actors.get(uid(index % 2 ? 2 : 3)).profile),
    id: uid(number),
    full_name: `Local QA Fictional Demo ${index + 1}`,
    member_type: index % 2 ? "global" : "china",
    avatar_url: image(uid(number)),
    cover_url: image(uid(number), "cover"),
    network_visible: true,
    is_demo: true,
    verified: false,
    rating: null,
    review_count: 0,
    completed_connections: 0,
  }));
  return { actors, connections, reviews, demos, demosVisible: true };
}
state = initialState();
function send(res, status, value, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "X-Ambro-QA": "in-memory",
    ...headers,
  });
  res.end(JSON.stringify(value));
}
function scenarioFor(req) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("ambro_qa_scenario="));
  const selected = cookie?.split("=")[1];
  return SCENARIOS.includes(selected) ? selected : "anonymous";
}
function currentActor(req) {
  const scenario = scenarioFor(req);
  return state.actors.get(
    uid({ admin: 1, global: 2, china: 3, expired: 4 }[scenario]),
  );
}
function connectionFor(item, viewer) {
  const sender = state.actors.get(item.sender_id),
    recipient = state.actors.get(item.recipient_id);
  const person = (value) =>
    value
      ? Object.fromEntries(
          ["id", "full_name", "avatar_url", "company", "city"].map((key) => [
            key,
            value.profile[key],
          ]),
        )
      : null;
  return {
    ...item,
    sender: person(sender),
    recipient: person(recipient),
    reviewed: state.reviews.some((review) => review.connection_id === item.id),
    contact_email: ["accepted", "completed"].includes(item.status)
      ? (item.sender_id === viewer.user.id
          ? recipient?.user.email
          : sender?.user.email) || null
      : null,
  };
}
function me(actor) {
  return {
    configured: true,
    user: actor?.user || null,
    profile: actor?.profile || null,
    membership: actor?.membership || null,
    connections: actor
      ? state.connections
          .filter((item) =>
            [item.sender_id, item.recipient_id].includes(actor.user.id),
          )
          .map((item) => connectionFor(item, actor))
      : [],
  };
}
function directory() {
  const members = [...state.actors.values()]
    .filter(
      (actor) =>
        !actor.user.is_admin &&
        actor.membership.active &&
        actor.membership.moderation_status === "approved" &&
        (actor.membership.member_type === "china" ||
          actor.profile.network_visible),
    )
    .map((actor) => {
      const approved = state.reviews.filter(
        (review) =>
          review.recipient_id === actor.user.id && review.status === "approved",
      );
      return {
        ...actor.profile,
        member_type: actor.membership.member_type,
        is_demo: false,
        verified: true,
        rating: approved.length
          ? approved.reduce((total, review) => total + review.rating, 0) /
            approved.length
          : null,
        review_count: approved.length,
        completed_connections: state.connections.filter(
          (item) =>
            item.recipient_id === actor.user.id && item.status === "completed",
        ).length,
      };
    });
  return [...members, ...(state.demosVisible ? state.demos : [])];
}
async function body(req) {
  let value = "";
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 100000) throw new Error("Local QA request too large.");
  }
  return value ? JSON.parse(value) : {};
}
function requireActor(actor) {
  if (!actor)
    throw Object.assign(new Error("Please sign in to continue."), {
      status: 401,
    });
}
function requireAdmin(actor) {
  requireActor(actor);
  if (!actor.user.is_admin)
    throw Object.assign(new Error("Administrator access is required."), {
      status: 403,
    });
}
async function api(req, res, url) {
  const actor = currentActor(req),
    path = url.pathname,
    method = req.method;
  if (method === "GET") {
    if (path === "/api/me") return send(res, 200, me(actor));
    if (path === "/api/profile") {
      requireActor(actor);
      return send(res, 200, { profile: actor.profile });
    }
    if (path === "/api/members") {
      let members = directory();
      for (const [param, field] of [
        ["member_type", "member_type"],
        ["city", "city"],
      ])
        if (url.searchParams.get(param))
          members = members.filter(
            (item) => item[field] === url.searchParams.get(param),
          );
      if (url.searchParams.get("query"))
        members = members.filter((item) =>
          [
            item.full_name,
            item.bio,
            item.city,
            item.company,
            ...item.specialties,
          ]
            .join(" ")
            .toLowerCase()
            .includes(url.searchParams.get("query").toLowerCase()),
        );
      return send(res, 200, { configured: true, members });
    }
    if (path.startsWith("/api/members/")) {
      const id = path.slice("/api/members/".length),
        member = directory().find((item) => item.id === id);
      return member
        ? send(res, 200, {
            member,
            reviews: member.is_demo
              ? []
              : state.reviews.filter(
                  (review) =>
                    review.recipient_id === id && review.status === "approved",
                ),
          })
        : send(res, 404, { error: "This local QA member is unavailable." });
    }
    if (path === "/api/admin") {
      requireAdmin(actor);
      return send(res, 200, {
        demo_members: {
          total: state.demos.length,
          visible: state.demosVisible ? state.demos.length : 0,
        },
        profiles: [...state.actors.values()].map((value) => ({
          ...value.profile,
          member_type: value.membership.member_type,
          moderation_status: value.membership.moderation_status,
        })),
        requests: [...state.actors.values()].flatMap((value) =>
          value.membership.requests
            .filter((request) => request.status === "pending")
            .map((request) => ({
              ...request,
              full_name: value.profile.full_name,
              member_type: value.membership.member_type,
            })),
        ),
        reviews: state.reviews.filter((review) => review.status === "pending"),
      });
    }
    return send(res, 501, {
      error: "This API is not implemented in local QA. It was not forwarded.",
    });
  }
  // All API writes terminate in this branch; no upstream request is ever made.
  if (path === "/api/upload")
    return send(res, 501, {
      error:
        "Photo uploads are disabled in local QA. No image was sent to the live service.",
    });
  const supported = new Set([
    "POST /api/auth",
    "PUT /api/profile",
    "POST /api/membership",
    "POST /api/connections",
    "PATCH /api/connections",
    "POST /api/reviews",
    "PATCH /api/admin",
  ]);
  if (!supported.has(`${method} ${path}`))
    return send(res, 501, {
      error:
        "This API write is not implemented in local QA. It was not forwarded.",
    });
  const data = await body(req);
  if (path === "/api/auth" && method === "POST") {
    if (data.action === "logout")
      return send(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie":
            "ambro_qa_scenario=anonymous; Path=/; HttpOnly; SameSite=Lax",
        },
      );
    return send(res, 501, {
      error:
        "Real authentication is disabled in local QA. Choose a scenario at /__qa/global or /__qa/admin.",
    });
  }
  if (path === "/api/profile" && method === "PUT") {
    requireActor(actor);
    for (const key of [
      "full_name",
      "bio",
      "city",
      "company",
      "specialties",
      "languages",
      "avatar_url",
      "cover_url",
      "achievements",
      "portfolio",
      "network_visible",
    ])
      if (Object.hasOwn(data, key)) actor.profile[key] = data[key];
    actor.profile.updated_at = timestamp(0);
    if (
      actor.membership.member_type === "china" ||
      actor.profile.network_visible
    ) {
      actor.membership.moderation_status = "pending";
      actor.membership.active = false;
    }
    return send(res, 200, { ok: true, profile: actor.profile });
  }
  if (path === "/api/membership" && method === "POST") {
    requireActor(actor);
    if (actor.membership.requests.some((item) => item.status === "pending"))
      return send(res, 400, {
        error: "You already have a membership request awaiting review.",
      });
    const request = {
      id: randomUUID(),
      user_id: actor.user.id,
      plan: data.plan,
      reference: data.reference,
      note: data.note || "",
      status: "pending",
      rejection_reason: null,
      created_at: timestamp(0),
      reviewed_at: null,
    };
    actor.membership.requests.unshift(request);
    return send(res, 201, { ok: true, id: request.id });
  }
  if (path === "/api/connections" && method === "POST") {
    requireActor(actor);
    if (actor.membership.member_type !== "global" || !actor.membership.active)
      return send(res, 400, {
        error: "An active Global membership is required to connect.",
      });
    if (!data.consent)
      return send(res, 400, {
        error:
          "Please agree to share your account email if the request is accepted.",
      });
    if (state.demos.some((item) => item.id === data.recipient_id))
      return send(res, 400, {
        error: "Demo profiles cannot receive connection requests.",
      });
    if (
      !directory().some(
        (item) => item.id === data.recipient_id && !item.is_demo,
      )
    )
      return send(res, 400, {
        error: "This member is not currently available.",
      });
    if (
      state.connections.some(
        (item) =>
          ["pending", "accepted"].includes(item.status) &&
          [item.sender_id, item.recipient_id].includes(actor.user.id) &&
          [item.sender_id, item.recipient_id].includes(data.recipient_id),
      )
    )
      return send(res, 409, {
        error: "This request has already been submitted.",
      });
    const item = {
      id: randomUUID(),
      sender_id: actor.user.id,
      recipient_id: data.recipient_id,
      message: data.message,
      status: "pending",
      created_at: timestamp(0),
      updated_at: timestamp(0),
      reviewed: false,
    };
    state.connections.unshift(item);
    return send(res, 201, { ok: true, id: item.id });
  }
  if (path === "/api/connections" && method === "PATCH") {
    requireActor(actor);
    const item = state.connections.find((item) => item.id === data.id);
    if (!item || item.recipient_id !== actor.user.id)
      return send(res, 403, {
        error: "Only the recipient can update this connection.",
      });
    if (data.status === "accepted" && !data.consent)
      return send(res, 400, {
        error: "Agree to share your email before accepting.",
      });
    if (!(
      (item.status === "pending" &&
        ["accepted", "declined"].includes(data.status)) ||
      (item.status === "accepted" && data.status === "completed")
    ))
      return send(res, 400, {
        error: "This connection cannot move to that status.",
      });
    item.status = data.status;
    item.updated_at = timestamp(0);
    return send(res, 200, { ok: true });
  }
  if (path === "/api/reviews" && method === "POST") {
    requireActor(actor);
    const connection = state.connections.find(
      (item) =>
        item.id === data.connection_id &&
        item.sender_id === actor.user.id &&
        item.status === "completed",
    );
    if (!connection)
      return send(res, 400, {
        error: "You can review only your own completed connections.",
      });
    if (state.reviews.some((item) => item.connection_id === connection.id))
      return send(res, 409, {
        error: "This request has already been submitted.",
      });
    const review = {
      id: randomUUID(),
      connection_id: connection.id,
      reviewer_id: actor.user.id,
      recipient_id: connection.recipient_id,
      rating: data.rating,
      body: data.body,
      status: "pending",
      created_at: timestamp(0),
      reviewer_name: actor.profile.full_name,
    };
    state.reviews.unshift(review);
    return send(res, 201, { ok: true, id: review.id });
  }
  if (path === "/api/admin" && method === "PATCH") {
    requireAdmin(actor);
    if (data.action === "demo_visibility") {
      state.demosVisible = Boolean(data.visible);
      return send(res, 200, { ok: true });
    }
    if (data.decision === "rejected" && !data.reason?.trim())
      return send(res, 400, {
        error: "A reason is required for this decision.",
      });
    if (data.kind === "profile") {
      const value = state.actors.get(data.id);
      if (!value)
        return send(res, 404, { error: "Local QA profile not found." });
      value.membership.moderation_status = data.decision;
      value.membership.moderation_reason = data.reason || null;
      value.membership.active =
        data.decision === "approved" &&
        Boolean(
          value.membership.current &&
          new Date(value.membership.current.expires_at) > new Date(),
        );
      return send(res, 200, { ok: true });
    }
    if (data.kind === "membership") {
      const owner = [...state.actors.values()].find((value) =>
        value.membership.requests.some((item) => item.id === data.id),
      );
      const request = owner?.membership.requests.find(
        (item) => item.id === data.id,
      );
      if (!request)
        return send(res, 404, {
          error: "Local QA membership request not found.",
        });
      request.status = data.decision;
      request.reviewed_at = timestamp(0);
      request.rejection_reason = data.reason || null;
      if (data.decision === "approved") {
        owner.membership.current = {
          id: randomUUID(),
          plan: request.plan,
          amount_rmb:
            request.plan === "china_yearly"
              ? 1000
              : request.plan === "trip_year"
                ? 0
                : 100,
          starts_at: timestamp(0),
          expires_at: timestamp(request.plan === "global_monthly" ? 30 : 365),
        };
        owner.membership.active =
          owner.membership.moderation_status === "approved";
      }
      return send(res, 200, { ok: true });
    }
    if (data.kind === "review") {
      const review = state.reviews.find((item) => item.id === data.id);
      if (review) {
        review.status = data.decision;
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 400, { error: "Choose a local QA queue item." });
  }
  return send(res, 501, {
    error:
      "This API write is not implemented in local QA. It was not forwarded.",
  });
}
function art(res, pathname) {
  const cover = !pathname.endsWith("/avatar.svg");
  const number = Number(pathname.match(/([0-9]{12})\//)?.[1] || 0);
  const colors = ["#d9dc9b", "#d7c7b2", "#b7cbc5", "#d7b8a8"];
  const bg = colors[number % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cover ? "1000 420" : "240 240"}"><rect width="100%" height="100%" fill="${bg}"/>${cover ? '<path d="M0 350 Q250 120 500 320 T1000 240 V420 H0Z" fill="#213c32"/><circle cx="800" cy="105" r="62" fill="#f3e9d4"/>' : '<circle cx="120" cy="90" r="45" fill="#213c32"/><path d="M30 240 Q30 145 120 145 Q210 145 210 240Z" fill="#213c32"/>'}<text x="${cover ? 35 : 12}" y="${cover ? 45 : 25}" fill="#213c32" font-family="sans-serif" font-size="${cover ? 22 : 15}">LOCAL QA · FICTIONAL</text></svg>`;
  res.writeHead(200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store",
    "X-Ambro-QA": "in-memory",
  });
  res.end(svg);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    let canonicalPath = url.pathname;
    for (let index = 0; index < 3; index++) {
      const decoded = decodeURIComponent(canonicalPath);
      if (decoded === canonicalPath) break;
      canonicalPath = decoded;
    }
    canonicalPath = canonicalPath.replaceAll("\\", "/").replace(/\/+/g, "/");
    if (canonicalPath === "/api" || canonicalPath.startsWith("/api/"))
      url.pathname = canonicalPath;
    if (url.pathname.startsWith("/__qa/art/")) return art(res, url.pathname);
    if (url.pathname.startsWith("/__qa/")) {
      const scenario = url.pathname.split("/")[2];
      if (!SCENARIOS.includes(scenario))
        return send(res, 404, {
          error: "Choose admin, global, china, expired or anonymous.",
        });
      if (url.searchParams.get("reset") === "1") state = initialState();
      const next = url.searchParams.get("next");
      const destination = [
        "/admin",
        "/account",
        "/connections",
        "/discover",
        "/login",
        "/how-to-use",
      ].includes(next)
        ? next
        : scenario === "admin"
          ? "/admin"
          : scenario === "anonymous"
            ? "/login"
            : "/account";
      res.writeHead(303, {
        Location: destination,
        "Set-Cookie": `ambro_qa_scenario=${scenario}; Path=/; HttpOnly; SameSite=Lax`,
        "Cache-Control": "no-store",
        "X-Ambro-QA": "in-memory",
      });
      return res.end();
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/"))
      return await api(req, res, url);
    if (!["GET", "HEAD"].includes(req.method))
      return send(res, 501, {
        error:
          "Non-API writes are disabled in local QA and were not forwarded.",
      });
    if (/^\/auth\/callback\/?$/i.test(canonicalPath))
      return send(res, 501, {
        error: "Real Auth callbacks are disabled in local QA.",
      });
    // Forward only page/static GETs and a short header allowlist. No cookies,
    // authorization, origin, body or client-supplied host crosses this boundary.
    const headers = {};
    for (const name of [
      "accept",
      "accept-language",
      "accept-encoding",
      "user-agent",
      "rsc",
      "next-router-state-tree",
      "next-router-prefetch",
      "next-url",
    ])
      if (req.headers[name]) headers[name] = req.headers[name];
    const upstream = http.request(
      { ...UPSTREAM, path: req.url, method: req.method, headers },
      (incoming) => {
        const responseHeaders = {
          ...incoming.headers,
          "x-ambro-qa": "in-memory",
        };
        delete responseHeaders["set-cookie"];
        res.writeHead(incoming.statusCode || 502, responseHeaders);
        incoming.pipe(res);
      },
    );
    upstream.on("error", () =>
      send(res, 502, {
        error:
          "Start the local Next app server on port 3010, then reload this local QA proxy.",
      }),
    );
    upstream.end();
  } catch (error) {
    send(res, error.status || 400, {
      error: error.message || "Local QA request failed.",
    });
  }
});
server.listen(PORT, HOST, () =>
  console.log(
    `Local QA only: http://${HOST}:${PORT}/__qa/admin?reset=1\nScenarios: /__qa/global /__qa/china /__qa/expired /__qa/anonymous\nEvery /api request is in memory. No cookies or API writes are forwarded.`,
  ),
);
