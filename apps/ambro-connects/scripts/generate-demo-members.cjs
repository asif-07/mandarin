#!/usr/bin/env node
/* Creates fictional display data and original SVG artwork. Never accesses a database. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const artDirectory = path.join(root, "public", "demo");
fs.mkdirSync(artDirectory, { recursive: true });

const people = [
  {
    name: "Lin Qiao", city: "Guangzhou", company: "Lanternline Sourcing", segment: "Sourcing", type: "china", languages: ["Mandarin", "English"], specialties: ["Sourcing", "Homeware", "Sample coordination"],
    bio: "I help a buyer turn an early homeware idea into a clear sample brief. My focus is comparing materials, organising factory questions, and keeping the choices understandable before a sourcing visit. I enjoy working with first-time China visitors who want to learn the process as they go.",
    achievements: ["Built a sample-comparison framework for small homeware ranges", "Designed a bilingual factory-visit preparation checklist", "Created a materials reference library for product discussions"],
    projects: [["Homeware sample study", "An illustrated exercise comparing shape, finish, and packaging options for a small tableware collection."], ["Factory visit brief", "A sample visit workbook showing the questions, product priorities, and follow-up notes a buyer could prepare."]],
  },
  {
    name: "Jun Wei", city: "Shenzhen", company: "Circuit Grove Studio", segment: "Sourcing", type: "china", languages: ["Mandarin", "English", "Cantonese"], specialties: ["Sourcing", "Consumer electronics", "Supplier research"],
    bio: "I explore consumer-electronics supply chains with a practical eye for product specifications. I can help frame a supplier comparison, organise a sample review, and prepare a useful meeting agenda. My favourite projects start with a clear explanation of the buyer’s intended customer and use case.",
    achievements: ["Developed a product-specification comparison template", "Mapped an example supplier-research workflow", "Prepared a visual guide to sample-review notes"],
    projects: [["Portable light concept", "A sample product brief showing how battery, brightness, materials, and packaging questions could be organised."], ["Supplier shortlist board", "A fictional research board demonstrating how a buyer might compare capabilities and unanswered questions."]],
  },
  {
    name: "Mei An", city: "Yiwu", company: "Little Horizon Trading", segment: "Sourcing", type: "china", languages: ["Mandarin", "English"], specialties: ["Sourcing", "Giftware", "Market visits"],
    bio: "I make a large wholesale market feel easier to navigate. I focus on giftware, stationery, and everyday accessories, helping visitors plan a realistic route and capture useful product notes. I like a thoughtful shortlist more than a rushed day of collecting business cards.",
    achievements: ["Created a category-based wholesale-market visit planner", "Developed a product-photo and quotation note template", "Designed an example gift-range selection board"],
    projects: [["Gift range moodboard", "A fictional selection study for an everyday gift collection, organised by material, colour, and intended audience."], ["Market day route", "An illustrative route and note-taking plan for comparing giftware categories during a sourcing visit."]],
  },
  {
    name: "Rui Chen", city: "Foshan", company: "Form & Field Workshop", segment: "Sourcing", type: "china", languages: ["Mandarin", "English", "Cantonese"], specialties: ["Sourcing", "Furniture", "Materials"],
    bio: "I am interested in the details that make furniture sourcing clearer: dimensions, finishes, materials, and the questions behind a beautiful reference image. I help shape a showroom visit around a defined brief so buyers can compare options with more confidence and fewer loose notes.",
    achievements: ["Built a furniture-finish comparison worksheet", "Prepared a showroom-visit planning guide", "Created an example room-by-room procurement brief"],
    projects: [["Furniture finish library", "An illustrated sample palette comparing wood tones, upholstery, and metal finishes for a hospitality concept."], ["Showroom comparison kit", "A fictional furniture shortlist with measurement fields, reference images, and questions for a showroom discussion."]],
  },
  {
    name: "Tao Wen", city: "Shenzhen", company: "Harbour Path Logistics", segment: "Logistics", type: "china", languages: ["Mandarin", "English"], specialties: ["Logistics", "Freight planning", "Shipment coordination"],
    bio: "I help people think through the movement of goods before the last minute. My work centres on shipment information, collection schedules, and useful questions for freight partners. I enjoy explaining unfamiliar logistics terms in plain language so a new importer can have a better conversation.",
    achievements: ["Designed a shipment-information handover checklist", "Created an example freight-route comparison board", "Prepared a plain-language packing-list guide"],
    projects: [["Shipment handover map", "A fictional logistics workflow showing the information to confirm between a supplier, buyer, and freight partner."], ["Freight route study", "An illustrative comparison of shipment stages and planning questions, without offering real rates or transit promises."]],
  },
  {
    name: "Yuna Luo", city: "Ningbo", company: "Estuary Cargo Desk", segment: "Logistics", type: "china", languages: ["Mandarin", "English"], specialties: ["Logistics", "Export documentation", "Port coordination"],
    bio: "I focus on keeping the documentary side of an export conversation organised. I help people identify the information they need, spot gaps in a handover, and prepare questions for the qualified partners involved. A calm checklist is often the most useful thing at a busy moment.",
    achievements: ["Built an export-document completeness checklist", "Prepared a sample port-handover information map", "Created a terminology reference for new exporters"],
    projects: [["Document flow workbook", "A fictional set of document placeholders showing how details could be checked across a shipment handover."], ["Port handover board", "An illustrated planning board for organising milestones, responsibilities, and questions around a port movement."]],
  },
  {
    name: "Bo Han", city: "Guangzhou", company: "Parcel & Passage", segment: "Logistics", type: "china", languages: ["Mandarin", "English", "Cantonese"], specialties: ["Logistics", "Consolidation planning", "Packaging"],
    bio: "I like turning several small purchasing decisions into one coherent shipping conversation. I focus on collection planning, carton information, and packaging questions for buyers visiting multiple suppliers. My starting point is a shared list of what is ready, what is missing, and who needs to confirm it.",
    achievements: ["Created a multi-supplier collection tracker", "Designed a carton-information review sheet", "Prepared an example consolidation planning guide"],
    projects: [["Multi-supplier collection plan", "A fictional planning exercise showing how several product pickups could be organised into one handover schedule."], ["Packaging information cards", "Illustrative cards showing the dimensions, handling notes, and open questions useful in a packaging discussion."]],
  },
  {
    name: "Xia Ning", city: "Shanghai", company: "Waypoint Freight Studio", segment: "Logistics", type: "china", languages: ["Mandarin", "English"], specialties: ["Logistics", "Supply-chain planning", "Trade coordination"],
    bio: "I approach logistics as a sequence of decisions, not just a booking. I can help outline the people, documents, and milestones a small trading business should discuss with its service providers. I work best with visitors who want a clear map before they choose a route.",
    achievements: ["Developed a milestone-based shipment planning board", "Created a responsibility-mapping worksheet", "Prepared a sample first-shipment briefing pack"],
    projects: [["First shipment roadmap", "A fictional visual roadmap for a new trading business to discuss responsibilities and milestones with its providers."], ["Supply-chain conversation kit", "An illustrated briefing pack for collecting product, timing, and delivery questions before requesting professional advice."]],
  },
  {
    name: "An Li", city: "Guangzhou", company: "Clearbridge Language Studio", segment: "Translation", type: "china", languages: ["Mandarin", "English", "Cantonese"], specialties: ["Translation", "Business meetings", "Trade fair support"],
    bio: "I help a business conversation stay clear across languages. My focus is meeting preparation, shared terminology, and thoughtful follow-up notes for sourcing and trade-fair visits. I like to understand the purpose of a meeting first, so the language support serves the actual discussion.",
    achievements: ["Built a bilingual sourcing-meeting glossary", "Designed a trade-fair conversation preparation sheet", "Created a sample meeting-summary format"],
    projects: [["Trade fair language kit", "A fictional bilingual preparation kit with example question categories and space for a visitor’s product vocabulary."], ["Meeting notes study", "An illustrative note-taking format separating decisions, open questions, and next steps after a business discussion."]],
  },
  {
    name: "Ning Xu", city: "Shanghai", company: "Paper Kite Language", segment: "Translation", type: "china", languages: ["Mandarin", "English", "French"], specialties: ["Translation", "Brand communication", "Editorial adaptation"],
    bio: "I am interested in the space between a literal translation and a message that feels natural. I focus on product stories, visitor information, and brand introductions, with careful questions about audience and tone. I enjoy helping international teams prepare a clearer first impression in China.",
    achievements: ["Created a tone-of-voice adaptation worksheet", "Developed a bilingual brand-introduction structure", "Prepared a sample editorial review checklist"],
    projects: [["Brand introduction study", "A fictional layout showing how the same short business introduction could be adapted for different reading contexts."], ["Visitor guide language board", "An illustrative editorial exercise exploring clear headings, practical instructions, and consistent terminology."]],
  },
  {
    name: "Hana Zhou", city: "Shenzhen", company: "Openphrase Studio", segment: "Translation", type: "china", languages: ["Mandarin", "English", "Korean"], specialties: ["Translation", "Product terminology", "Supplier meetings"],
    bio: "I help teams prepare the language around a product before a supplier meeting begins. I enjoy building simple glossaries, checking that questions are precise, and making room for clarification. My approach is collaborative: the best translation starts with understanding what everyone is trying to decide.",
    achievements: ["Designed a product-terminology preparation template", "Created a clarification-question reference sheet", "Built a sample bilingual supplier briefing"],
    projects: [["Product glossary workshop", "A fictional terminology board grouping example product features, materials, and clarification questions for a meeting."], ["Supplier briefing cards", "Illustrated sample cards for preparing concise questions and recording technical terms that need follow-up."]],
  },
  {
    name: "Wei Su", city: "Chengdu", company: "Common Thread Language", segment: "Translation", type: "china", languages: ["Mandarin", "English", "Spanish"], specialties: ["Translation", "Cultural exchange", "Travel support"],
    bio: "I enjoy helping visitors ask better questions and hear the stories behind a place. I focus on language support for cultural visits, community meetings, and small-group travel conversations. A little preparation around names, context, and expectations can make an introduction feel much more comfortable.",
    achievements: ["Prepared a cultural-visit vocabulary workbook", "Created a sample small-group introduction guide", "Designed a visitor-question planning sheet"],
    projects: [["Cultural visit phraseboard", "A fictional language-preparation board for a cultural visit, with example topics rather than a real itinerary."], ["Community introduction kit", "An illustrative guide to preparing names, context, and open questions before a small-group introduction."]],
  },
  {
    name: "Jia Song", city: "Guangzhou", company: "Gatherline Business Studio", segment: "Business services", type: "china", languages: ["Mandarin", "English", "Cantonese"], specialties: ["Business services", "Market research", "Meeting preparation"],
    bio: "I help a business visit start with a sharper question. I focus on desk research, meeting preparation, and organising what a team learns along the way. I enjoy working with small businesses exploring a new market, especially when they want a practical research plan before making commitments.",
    achievements: ["Built a market-entry discovery worksheet", "Designed a structured business-visit debrief", "Prepared an example competitor observation board"],
    projects: [["Market questions canvas", "A fictional research canvas that turns broad business ambitions into topics for structured conversations and further investigation."], ["Business visit debrief", "An illustrated sample workbook for recording observations, uncertainties, and next research steps after a visit."]],
  },
  {
    name: "Yue Tan", city: "Shanghai", company: "Northwindow Strategy Desk", segment: "Business services", type: "china", languages: ["Mandarin", "English"], specialties: ["Business services", "Brand research", "Retail observation"],
    bio: "I look at how products meet people: the shop floor, the product story, and the questions customers ask. I focus on organising retail observations and brand-research conversations for visiting teams. I like to keep evidence, interpretation, and unanswered questions clearly separate.",
    achievements: ["Created a retail-observation note system", "Built a sample brand-positioning comparison canvas", "Developed an evidence-and-assumptions review sheet"],
    projects: [["Retail observation journal", "A fictional journal layout showing how a visiting team could organise product-display and customer-experience observations."], ["Brand landscape board", "An illustrative research board comparing positioning themes without representing real brands or market conclusions."]],
  },
  {
    name: "Kai Lu", city: "Hangzhou", company: "Morrow Commerce Lab", segment: "Business services", type: "china", languages: ["Mandarin", "English"], specialties: ["Business services", "E-commerce planning", "Product storytelling"],
    bio: "I am curious about the journey from a product idea to a clear online story. I help outline research questions, product-page information, and the operational topics a new e-commerce project should explore. My aim is a practical planning conversation, with specialist advice brought in where needed.",
    achievements: ["Designed a product-page information checklist", "Prepared an e-commerce discovery workshop canvas", "Created an example content-production workflow"],
    projects: [["Product story framework", "A fictional product-page planning exercise linking customer questions with images, specifications, and helpful explanations."], ["Commerce launch canvas", "An illustrative planning canvas for discussing research, content, fulfilment, and other launch dependencies with a team."]],
  },
  {
    name: "Min He", city: "Shenzhen", company: "Fieldnote Operations", segment: "Business services", type: "china", languages: ["Mandarin", "English"], specialties: ["Business services", "Operations planning", "Project coordination"],
    bio: "I help turn a productive meeting into an organised next step. I focus on shared action lists, project handovers, and useful communication rhythms for small international teams. I enjoy the quieter side of collaboration: clear ownership, realistic questions, and notes everyone can find later.",
    achievements: ["Created a cross-team action-log template", "Designed a project-handover checklist", "Built a sample international-team communication guide"],
    projects: [["Project handover studio", "A fictional operations board showing how decisions, owners, and outstanding questions could be handed between teams."], ["Shared action journal", "An illustrated example of a simple action log for a small business project spanning different locations."]],
  },
  {
    name: "Lan Yu", city: "Guangzhou", company: "Citrus Lane Travel Studio", segment: "Travel", type: "china", languages: ["Mandarin", "English", "Cantonese"], specialties: ["Travel", "City orientation", "Food & culture"],
    bio: "I enjoy helping a first visit feel more familiar. I focus on city orientation, neighbourhood stories, and the practical questions that come with exploring Guangzhou. I like a thoughtful pace that leaves space for food, conversation, and the unexpected turn that becomes a favourite memory.",
    achievements: ["Created an example neighbourhood orientation guide", "Designed a visitor-preferences planning sheet", "Prepared a food-and-culture conversation map"],
    projects: [["Guangzhou neighbourhood notes", "A fictional illustrated city-orientation concept exploring how a visitor might collect neighbourhood interests and practical questions."], ["A day with room to wander", "An illustrative travel-planning board balancing culture, conversation, and breaks; not a bookable itinerary."]],
  },
  {
    name: "Chen Mo", city: "Beijing", company: "Quiet Gate Journeys", segment: "Travel", type: "china", languages: ["Mandarin", "English"], specialties: ["Travel", "Cultural visits", "Small-group planning"],
    bio: "I like helping curious visitors find the story behind a landmark. I focus on preparing cultural visits, understanding a group’s interests, and building sensible time for questions and reflection. I enjoy trips where people return with a richer understanding of a place, as well as photographs.",
    achievements: ["Built a sample cultural-visit preparation workbook", "Created a small-group interests questionnaire", "Designed an accessible pacing discussion guide"],
    projects: [["Culture before the visit", "A fictional preparation workbook collecting context, visitor interests, and questions before a cultural outing."], ["Small-group journey canvas", "An illustrated planning concept for discussing pace, interests, and practical needs; no dates or bookings offered."]],
  },
  {
    name: "Yun Fei", city: "Chengdu", company: "Bamboo Window Travel", segment: "Travel", type: "china", languages: ["Mandarin", "English", "Japanese"], specialties: ["Travel", "Local experiences", "Food & culture"],
    bio: "I am drawn to the everyday details of a city: a market conversation, a shared meal, or a craft with a story. I help visitors think about the kinds of local experiences they enjoy and the questions to ask before planning them. A comfortable pace matters to me.",
    achievements: ["Created a local-experience interests canvas", "Prepared a sample food-preferences discussion sheet", "Designed an illustrated cultural-curiosity journal"],
    projects: [["Everyday Chengdu notebook", "A fictional visual notebook for collecting food, craft, and neighbourhood interests before planning a local experience."], ["Shared table concept", "An illustrative experience-planning board centred on conversation and food preferences; not a real tour offer."]],
  },
  {
    name: "Qing Zhao", city: "Xi’an", company: "Terrace & Trail Studio", segment: "Travel", type: "china", languages: ["Mandarin", "English"], specialties: ["Travel", "Heritage visits", "Visitor planning"],
    bio: "I help visitors connect a big cultural interest with the practical shape of a day. I focus on heritage-visit preparation, useful background reading, and clear questions about pacing and access. I enjoy meeting people who want to understand a place thoughtfully, with time to notice the details.",
    achievements: ["Designed a heritage-visit planning journal", "Prepared a sample visitor-access questions checklist", "Created a cultural-background reading-board concept"],
    projects: [["Heritage curiosity journal", "A fictional journal pairing cultural questions with preparation notes for a thoughtful heritage visit."], ["Visit planning cards", "Illustrative cards for discussing pace, access, and visitor interests before choosing an actual travel provider."]],
  },
  {
    name: "Maya Nair", city: "Kochi, India", company: "Palm & Paper Collective", segment: "Sourcing", type: "global", languages: ["English", "Malayalam", "Hindi"], specialties: ["Sourcing", "Homeware", "Design-led retail"],
    bio: "I am developing an idea for a small homeware shop with a careful material palette. I would like to understand how to prepare a useful sourcing brief and compare samples before making decisions. I hope to meet people who enjoy explaining their process and sharing a local perspective.",
    achievements: ["Drafted a fictional homeware brand concept", "Built an example product-material moodboard", "Prepared an introductory sourcing research brief"],
    projects: [["A quieter everyday", "A fictional retail concept exploring natural textures, simple forms, and a small homeware product range."], ["Sourcing questions journal", "An illustrative workbook gathering sample, packaging, and material questions for a possible future visit."]],
  },
  {
    name: "Omar Faris", city: "Dubai, UAE", company: "Dune Workshop Concept", segment: "Sourcing", type: "global", languages: ["Arabic", "English"], specialties: ["Sourcing", "Furniture", "Hospitality concepts"],
    bio: "I am exploring how a hospitality concept could be supported by a thoughtful furniture brief. I want to learn what information makes a showroom conversation productive, from dimensions to finishes. I would welcome connections with people who can help me ask better questions and understand available options.",
    achievements: ["Developed a fictional hospitality moodboard", "Created a room-by-room furniture brief", "Prepared an example finish-comparison worksheet"],
    projects: [["Courtyard stay concept", "A fictional hospitality moodboard combining warm materials, relaxed shared spaces, and a concise furniture palette."], ["Furniture visit preparation", "An illustrative workbook for organising measurements, finishes, and questions before visiting a showroom."]],
  },
  {
    name: "Sofia Duarte", city: "Lisbon, Portugal", company: "Softline Objects Studio", segment: "Sourcing", type: "global", languages: ["Portuguese", "English", "Spanish"], specialties: ["Sourcing", "Product design", "Giftware"],
    bio: "I am a product-design enthusiast exploring a collection of useful everyday objects. I am interested in how a sketch becomes a clear discussion about materials, samples, and packaging. I would like to meet people in China who enjoy the early questions as much as the finished product.",
    achievements: ["Created a fictional everyday-object design series", "Prepared a sample packaging moodboard", "Built an example product-development question bank"],
    projects: [["Everyday forms collection", "A fictional design exploration of small desktop objects, with emphasis on shape, texture, and everyday use."], ["From sketch to conversation", "An illustrated briefing exercise linking product sketches to questions about materials and sample development."]],
  },
  {
    name: "Daniel Okoye", city: "Lagos, Nigeria", company: "Brightway Trade Concept", segment: "Logistics", type: "global", languages: ["English", "Igbo"], specialties: ["Logistics", "Trade planning", "Consumer goods"],
    bio: "I am researching the practical steps behind a small consumer-goods trading idea. I want to understand the questions to ask about supplier handovers, shipment information, and freight coordination. I value patient explanations and would like to build a useful network before planning a sourcing visit.",
    achievements: ["Mapped a fictional first-import research plan", "Created an example shipment-information checklist", "Prepared a consumer-goods category exploration"],
    projects: [["First trade roadmap", "A fictional planning map showing the people, information, and questions involved in an early trading concept."], ["Product-to-port notebook", "An illustrative notebook connecting product research with packaging and shipment questions for future professional advice."]],
  },
  {
    name: "Aisha Rahman", city: "Kuala Lumpur, Malaysia", company: "Common Table Ventures", segment: "Business services", type: "global", languages: ["Malay", "English", "Tamil"], specialties: ["Business services", "Market research", "Retail concepts"],
    bio: "I enjoy looking at the relationship between a product, a shop, and the community around it. I am developing a retail research concept and would like to exchange perspectives with people working in China. I am especially interested in thoughtful observations, clear evidence, and useful introductions.",
    achievements: ["Designed a fictional retail research canvas", "Created a customer-question interview guide", "Prepared an example store-observation journal"],
    projects: [["Neighbourhood retail study", "A fictional research concept exploring how small shops might understand their audience and present a coherent product story."], ["Questions worth asking", "An illustrative interview-planning workbook that separates assumptions, observations, and questions for future research."]],
  },
  {
    name: "Luca Marin", city: "Milan, Italy", company: "Forma Weekend Studio", segment: "Travel", type: "global", languages: ["Italian", "English"], specialties: ["Travel", "Design & culture", "City exploration"],
    bio: "I like discovering a city through architecture, objects, and everyday routines. I am curious about a future China visit that balances design interests with unhurried local experiences. I would enjoy meeting people who can share context, suggest good questions, and help a visitor see beyond a checklist.",
    achievements: ["Created a fictional design-travel journal", "Built an example architecture interest board", "Prepared a personal cultural-visit question list"],
    projects: [["A city through design", "A fictional travel-journal concept collecting architectural forms, everyday objects, and questions about local design culture."], ["Unhurried discovery board", "An illustrative interest board for a possible future visit; no real itinerary, dates, or bookings are represented."]],
  },
  {
    name: "Priya Menon", city: "Bengaluru, India", company: "Small Spark Product Lab", segment: "Sourcing", type: "global", languages: ["English", "Hindi", "Kannada"], specialties: ["Sourcing", "Consumer electronics", "Product research"],
    bio: "I am exploring an idea for a simple everyday technology product. I would like to learn how to prepare specifications, compare samples, and discuss a concept clearly with potential partners. I hope to connect with people who bring a practical product perspective and an openness to early-stage questions.",
    achievements: ["Drafted a fictional product problem statement", "Created a sample feature-priority canvas", "Prepared an introductory supplier-question worksheet"],
    projects: [["Small spark concept", "A fictional product-research board connecting an everyday user need with possible features and design questions."], ["Specification starter kit", "An illustrated exercise in organising product requirements, sample questions, and assumptions before a supplier conversation."]],
  },
  {
    name: "Ethan Brooks", city: "Melbourne, Australia", company: "Fieldwork Supply Concept", segment: "Business services", type: "global", languages: ["English"], specialties: ["Business services", "Operations planning", "Sustainable materials"],
    bio: "I am interested in the operational choices behind a considered product business. I want to learn more about materials research, useful supplier questions, and how a small team can keep a project organised. I would welcome connections that make the learning process clearer and more grounded.",
    achievements: ["Prepared a fictional materials-research framework", "Created an example small-team project board", "Developed a supplier-conversation preparation sheet"],
    projects: [["Considered materials canvas", "A fictional research framework for collecting material questions and documenting what still needs independent verification."], ["Small team, clear steps", "An illustrative project board showing how a small team might organise research, responsibilities, and decision points."]],
  },
  {
    name: "Nadia Azlan", city: "Singapore", company: "Story Atlas Collective", segment: "Translation", type: "global", languages: ["English", "Malay", "Mandarin"], specialties: ["Translation", "Cultural storytelling", "Brand communication"],
    bio: "I am curious about the way language shapes a first impression. I am exploring a cultural storytelling concept and would like to exchange ideas with people who work across languages in China. I enjoy conversations about audience, context, and the details that make a message feel welcoming.",
    achievements: ["Created a fictional cross-cultural story concept", "Prepared an audience-and-tone worksheet", "Built an example bilingual content planning board"],
    projects: [["Stories across places", "A fictional editorial concept exploring how a short cultural story could be presented to readers with different backgrounds."], ["A welcoming first sentence", "An illustrative language workshop board focused on audience, context, and approachable introductions."]],
  },
  {
    name: "Noah Patel", city: "London, United Kingdom", company: "Open Road Notes", segment: "Travel", type: "global", languages: ["English", "Gujarati"], specialties: ["Travel", "Food & culture", "First China visit"],
    bio: "I am gathering ideas for a first visit to China and want to understand the people and everyday experiences behind the famous places. I am especially interested in food, neighbourhoods, and thoughtful cultural conversations. I would love to meet local people who enjoy helping a curious visitor get oriented.",
    achievements: ["Created a fictional first-visit interests journal", "Prepared a food-and-culture curiosity map", "Built an example visitor-planning checklist"],
    projects: [["The first-visit notebook", "A fictional travel-preparation journal gathering cultural questions, practical topics, and personal interests without a real booking."], ["A place at the table", "An illustrative food-and-culture interest board for discussing preferences and learning about everyday experiences."]],
  },
];

const palette = [
  { bg: "#E8EBCF", accent: "#C35437", shirt: "#24483D", skin: "#D49B78", hair: "#29322C" },
  { bg: "#EBCBBA", accent: "#365A49", shirt: "#8B4432", skin: "#E5B392", hair: "#3E302A" },
  { bg: "#D6E3D9", accent: "#BB4B32", shirt: "#41665B", skin: "#B77C5A", hair: "#252B29" },
  { bg: "#EEE4CC", accent: "#54705A", shirt: "#B45237", skin: "#F0C6A8", hair: "#654838" },
  { bg: "#D9DED0", accent: "#C47852", shirt: "#2D4140", skin: "#946343", hair: "#292822" },
  { bg: "#F1DAD0", accent: "#5A725F", shirt: "#6D7351", skin: "#C58D68", hair: "#42382E" },
];

function xml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function slugify(value) { return value.normalize("NFKD").replace(/[’']/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function stableId(slug) {
  const namespace = Buffer.from("269104e0442b5272a3a28d155d6a2b40", "hex");
  const bytes = crypto.createHash("sha1").update(namespace).update(`ambro-connects-demo:${slug}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function svg(label, description, width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${xml(label)}</title><desc id="description">${xml(description)}</desc>${body}</svg>\n`;
}
function avatar(person, index) {
  const p = palette[index % palette.length];
  const hairStyle = (Math.floor(index / 6) + index) % 6;
  const longHair = hairStyle === 1 || hairStyle === 4;
  const backHair = longHair ? `<path d="M119 184Q110 87 198 77Q291 78 284 198L293 302Q264 328 230 298L158 301Q113 328 106 290Z" fill="${p.hair}"/>` : `<path d="M121 179Q110 94 184 81Q266 63 282 163L274 212L125 209Z" fill="${p.hair}"/>`;
  const frontHair = [
    `<path d="M123 161Q130 86 192 88Q257 76 281 155Q240 145 212 117Q184 156 123 161Z" fill="${p.hair}"/>`,
    `<path d="M122 178Q116 85 194 87Q269 77 280 163L263 198Q269 126 221 116Q179 157 134 160L133 199Z" fill="${p.hair}"/>`,
    `<path d="M123 153Q110 111 143 100Q151 71 179 84Q208 61 226 84Q265 80 276 115Q294 138 279 164L254 153Q222 133 198 131Q170 154 123 153Z" fill="${p.hair}"/>`,
    `<path d="M124 160Q124 102 177 91Q236 73 275 139L279 166Q235 149 210 117Q182 147 124 160Z" fill="${p.hair}"/>`,
    `<path d="M122 181Q114 106 168 89Q237 65 274 120L281 203L263 175Q253 121 211 112Q181 149 137 154L136 201Z" fill="${p.hair}"/><circle cx="274" cy="123" r="26" fill="${p.hair}"/>`,
    `<path d="M123 159Q119 103 175 89Q231 74 267 121L280 162L256 145Q229 132 208 115Q180 146 123 159Z" fill="${p.hair}"/>`,
  ][hairStyle];
  const glasses = index % 4 === 0 ? `<g fill="none" stroke="${p.hair}" stroke-width="5"><rect x="143" y="170" width="49" height="34" rx="12"/><rect x="208" y="170" width="49" height="34" rx="12"/><path d="M192 181h16m-65-3-13-5m127 5 13-5"/></g>` : "";
  const beard = index % 7 === 5 ? `<path d="M143 217Q150 263 199 267Q249 264 258 218Q241 251 200 248Q160 250 143 217Z" fill="${p.hair}" opacity=".88"/>` : "";
  const earrings = index % 5 === 1 ? `<g fill="none" stroke="#D0A965" stroke-width="5"><circle cx="128" cy="212" r="9"/><circle cx="272" cy="212" r="9"/></g>` : "";
  return svg(`Fictional demo avatar: ${person.name}`, "Original flat vector illustration of an imaginary adult. This is not a photograph or a real member.", 400, 400,
    `<rect width="400" height="400" rx="32" fill="${p.bg}"/><circle cx="339" cy="78" r="71" fill="${p.accent}" opacity=".17"/><path d="M-20 284Q88 229 153 300L85 420H-20Z" fill="${p.accent}" opacity=".14"/><path d="m49 70 19-9m-1 33 11-19m244 208 18 11" stroke="${p.accent}" stroke-width="6" stroke-linecap="round"/>${backHair}<path d="M61 400Q69 303 159 285L239 285Q330 306 340 400Z" fill="${p.shirt}"/><path d="M171 247h58v61Q200 336 171 307Z" fill="${p.skin}"/><path d="m157 288 43 39 42-39 20 15-34 50-28-26-29 26-35-50Z" fill="#F8F2E4"/><ellipse cx="128" cy="192" rx="13" ry="22" fill="${p.skin}"/><ellipse cx="272" cy="192" rx="13" ry="22" fill="${p.skin}"/><path d="M132 151Q139 111 199 106Q258 112 269 151V207Q260 265 200 275Q140 262 132 207Z" fill="${p.skin}"/>${frontHair}<g fill="${p.hair}"><ellipse cx="167" cy="184" rx="4" ry="5"/><ellipse cx="232" cy="184" rx="4" ry="5"/></g><path d="m199 190-5 26h12" fill="none" stroke="#9A6148" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M180 233Q200 245 221 232" fill="none" stroke="#783F35" stroke-width="4" stroke-linecap="round"/>${beard}${glasses}${earrings}<rect x="25" y="25" width="66" height="25" rx="12.5" fill="#F8F4E9"/><text x="58" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#25483B">DEMO</text>`);
}
function art(person, index, kind) {
  const p = palette[(index + (kind === "cover" ? 1 : kind)) % palette.length];
  const width = 960, height = kind === "cover" ? 420 : 640;
  const label = kind === "cover" ? `${person.segment.toUpperCase()} / ${person.type === "china" ? "CHINA" : "GLOBAL"}` : `CONCEPT STUDY / 0${kind}`;
  let motif;
  switch (person.segment) {
    case "Sourcing": motif = `<g transform="translate(450 55) rotate(${index % 2 ? 7 : -7} 180 150)"><rect x="25" y="35" width="255" height="250" rx="17" fill="#F8F2E5"/><rect x="55" y="68" width="82" height="82" rx="8" fill="${p.shirt}"/><rect x="156" y="68" width="92" height="82" rx="8" fill="${p.accent}"/><rect x="55" y="169" width="193" height="83" rx="8" fill="${p.bg}"/><path d="m304 107 100-45 89 49v130l-91 51-98-49Z" fill="${p.accent}"/><path d="m304 107 98 48 91-44m-91 44v137" fill="none" stroke="#F8F2E5" stroke-width="4"/><path d="m353 84 98 49v50l-28 15v-52l-99-48" fill="${p.shirt}"/></g>`; break;
    case "Logistics": motif = `<g transform="translate(420 55)"><path d="M12 85Q109-14 200 106T417 108" fill="none" stroke="#F8F2E5" stroke-width="5" stroke-dasharray="10 12"/><circle cx="12" cy="85" r="13" fill="${p.accent}"/><circle cx="417" cy="108" r="13" fill="${p.shirt}"/><rect x="38" y="166" width="213" height="112" rx="8" fill="${p.shirt}"/><rect x="242" y="207" width="185" height="112" rx="8" fill="${p.accent}"/><path d="M67 185v73m30-73v73m30-73v73m30-73v73m30-73v73m30-73v73m52-30v73m30-73v73m30-73v73m30-73v73m30-73v73" stroke="#F8F2E5" stroke-width="3" opacity=".65"/></g>`; break;
    case "Translation": motif = `<g transform="translate(450 50)"><path d="M0 40Q0 14 26 14h227q26 0 26 26v115q0 26-26 26h-59l-51 48v-48H26Q0 181 0 155Z" fill="${p.shirt}"/><path d="M165 161q0-23 23-23h200q24 0 24 23v104q0 23-24 23h-32v40l-49-40H188q-23 0-23-23Z" fill="${p.accent}"/><path d="M41 57h155M41 87h181M41 117h118m52 66h159m-159 31h127m-127 31h149" stroke="#F8F2E5" stroke-width="8" stroke-linecap="round" opacity=".9"/><circle cx="324" cy="48" r="29" fill="#F8F2E5"/><path d="m310 49 10 10 18-24" fill="none" stroke="${p.shirt}" stroke-width="5" stroke-linecap="round"/></g>`; break;
    case "Business services": motif = `<g transform="translate(470 35) rotate(-5 170 160)"><rect x="0" y="0" width="301" height="331" rx="16" fill="#F8F2E5"/><rect x="30" y="29" width="120" height="14" rx="7" fill="${p.shirt}"/><path d="M31 73h237M31 94h183" stroke="${p.shirt}" stroke-width="8" opacity=".25" stroke-linecap="round"/><rect x="35" y="208" width="49" height="86" rx="6" fill="${p.accent}"/><rect x="115" y="164" width="49" height="130" rx="6" fill="${p.shirt}"/><rect x="195" y="121" width="49" height="173" rx="6" fill="${p.accent}" opacity=".65"/><circle cx="327" cy="233" r="69" fill="${p.shirt}"/><path d="m297 234 22 21 40-48" fill="none" stroke="#F8F2E5" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>`; break;
    default: motif = `<g transform="translate(445 30)"><path d="M16 337V142Q16 16 139 16t123 126v195Z" fill="${p.shirt}"/><path d="M46 337V145q0-94 93-94t93 94v192Z" fill="#F8F2E5"/><circle cx="139" cy="125" r="39" fill="${p.accent}"/><path d="m45 270 75-73 55 55 57-40v125H45Z" fill="${p.bg}"/><path d="M46 301q67-50 125-20l61-24v80H46Z" fill="${p.shirt}" opacity=".65"/><g transform="translate(277 184) rotate(13)"><rect width="153" height="136" rx="12" fill="${p.accent}"/><circle cx="76" cy="68" r="42" fill="none" stroke="#F8F2E5" stroke-width="3"/><path d="m76 30 14 38-14 38-14-38Z" fill="#F8F2E5"/></g></g>`;
  }
  const title = kind === "cover" ? "Imaginary people.\nReal possibilities." : person.projects[kind - 1][0];
  const shortTitle = title.length > 27 ? title.split(" ").reduce((lines, word) => {
    if (`${lines[lines.length - 1]} ${word}`.trim().length > 25) lines.push(word); else lines[lines.length - 1] += `${lines[lines.length - 1] ? " " : ""}${word}`; return lines;
  }, [""]) : [title];
  const titleLines = kind === "cover" ? ["Imaginary people.", "Real possibilities."] : shortTitle;
  const startY = kind === "cover" ? 202 : 238;
  return svg(`Fictional ${person.segment.toLowerCase()} ${kind === "cover" ? "cover" : "portfolio artwork"} for ${person.name}`, "Original abstract vector art for a fictional demo profile. It does not depict a completed customer project.", width, height,
    `<rect width="${width}" height="${height}" fill="${p.bg}"/><circle cx="834" cy="80" r="245" fill="#F8F4E9" opacity=".3"/><path d="M390 ${height + 50}Q566 ${height - 158} 960 ${height - 52}v102Z" fill="${p.accent}" opacity=".12"/>${motif}<text x="44" y="63" font-family="Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="2.7" fill="#25483B">AMBRO CONNECTS / DEMO</text><path d="M44 87h64" stroke="${p.accent}" stroke-width="4"/>${titleLines.map((line, i) => `<text x="44" y="${startY + i * 43}" font-family="Georgia,serif" font-size="34" fill="#25483B">${xml(line)}</text>`).join("")}<text x="44" y="${height - 42}" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="1.9" fill="#25483B">${xml(label)}</text><rect x="${width - 162}" y="${height - 56}" width="118" height="26" rx="13" fill="#F8F4E9"/><text x="${width - 103}" y="${height - 39}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" letter-spacing="1.5" fill="#25483B">FICTIONAL STUDY</text>`);
}

const members = people.map((person, index) => {
  const slug = slugify(person.name);
  fs.writeFileSync(path.join(artDirectory, `${slug}-avatar.svg`), avatar(person, index));
  fs.writeFileSync(path.join(artDirectory, `${slug}-cover.svg`), art(person, index, "cover"));
  person.projects.forEach((_, projectIndex) => fs.writeFileSync(path.join(artDirectory, `${slug}-project-${projectIndex + 1}.svg`), art(person, index, projectIndex + 1)));
  return {
    id: stableId(slug), full_name: person.name, member_type: person.type, enabled: true,
    bio: `Fictional demo profile. ${person.bio}`, city: person.city, company: `Demo · ${person.company}`,
    specialties: person.specialties, languages: person.languages,
    avatar_url: `/demo/${slug}-avatar.svg`, cover_url: `/demo/${slug}-cover.svg`,
    achievements: person.achievements.map(value => `Illustrative: ${value.charAt(0).toLowerCase()}${value.slice(1)}`),
    portfolio: person.projects.map(([title, description], projectIndex) => ({ title, description: `Fictional demo project. ${description}`, image_url: `/demo/${slug}-project-${projectIndex + 1}.svg` })),
  };
});

for (const segment of ["Sourcing", "Logistics", "Translation", "Business services", "Travel"]) {
  if (members.filter(member => member.member_type === "china" && member.specialties.includes(segment)).length !== 4) throw new Error(`Expected four China profiles in ${segment}`);
}
if (members.length !== 30 || members.filter(member => member.member_type === "global").length !== 10) throw new Error("Expected 20 China and 10 Global demo profiles");
if (new Set(members.map(member => member.id)).size !== members.length) throw new Error("Duplicate demo member IDs");
for (const member of members) {
  if (member.achievements.length !== 3 || member.portfolio.length !== 2) throw new Error("Incomplete demo profile");
  for (const file of [member.avatar_url, member.cover_url, ...member.portfolio.map(project => project.image_url)]) {
    if (!fs.existsSync(path.join(root, "public", file))) throw new Error(`Missing asset ${file}`);
  }
}

const dataset = JSON.stringify(members, null, 2);
fs.writeFileSync(path.join(__dirname, "demo-members.json"), `${dataset}\n`);
const columns = ["id", "full_name", "member_type", "enabled", "bio", "city", "company", "specialties", "languages", "avatar_url", "cover_url", "achievements", "portfolio"];
const sql = `-- Ambro Connects: fictional display-only members. No Auth users, credentials, contacts, ratings, or reviews.\n-- Review before applying. This is an explicit seed operation, separate from schema migrations.\n-- Idempotent: generated namespaced UUIDs remain stable across regeneration.\nINSERT INTO public.demo_members (${columns.join(", ")})\nSELECT ${columns.join(", ")}\nFROM jsonb_to_recordset($ambro_demo_seed$\n${dataset}\n$ambro_demo_seed$::jsonb) AS seed (\n  id uuid, full_name text, member_type text, enabled boolean, bio text, city text, company text,\n  specialties text[], languages text[], avatar_url text, cover_url text, achievements text[], portfolio jsonb\n)\nON CONFLICT (id) DO UPDATE SET\n${columns.filter(column => column !== "id").map(column => `  ${column} = EXCLUDED.${column},`).join("\n")}\n  updated_at = now();\n`;
fs.writeFileSync(path.join(__dirname, "seed-demo-members.sql"), sql);
console.log(`Generated ${members.length} fictional profiles, ${members.length * 4} original SVG assets, and one idempotent seed statement. No database was contacted.`);
