// Generates profile/activity-graph.svg: daily contributions over the last 30 days.
import { writeFileSync, mkdirSync } from "node:fs";

const user = process.env.GH_USER;
const token = process.env.GH_TOKEN;
const DAYS = 30;

const to = new Date();
const from = new Date(to.getTime() - (DAYS - 1) * 864e5);
const query = `query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){contributionsCollection(from:$from,to:$to){
    contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: user, from: from.toISOString(), to: to.toISOString() } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? res.status));

const byDate = new Map();
for (const w of json.data.user.contributionsCollection.contributionCalendar.weeks)
  for (const d of w.contributionDays) byDate.set(d.date, d.contributionCount);

const days = [];
for (let i = 0; i < DAYS; i++) {
  const date = new Date(from.getTime() + i * 864e5).toISOString().slice(0, 10);
  days.push({ date, n: byDate.get(date) ?? 0 });
}

const W = 900, H = 300, L = 50, R = 20, T = 30, B = 45;
const max = Math.max(5, ...days.map((d) => d.n));
const niceMax = Math.ceil(max / 5) * 5;
const x = (i) => L + (i * (W - L - R)) / (DAYS - 1);
const y = (n) => T + (1 - n / niceMax) * (H - T - B);
const pts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.n).toFixed(1)}`);

const grid = [0, 1, 2, 3, 4, 5].map((k) => {
  const v = (niceMax * k) / 5;
  return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#A78BFA" stroke-opacity=".15"/>` +
    `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
}).join("");
const labels = days.map((d, i) => i % 3 === 0
  ? `<text x="${x(i)}" y="${H - B + 20}" text-anchor="middle">${d.date.slice(5)}</text>` : "").join("");
const dots = days.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.n)}" r="3.5" fill="#C4B5FD"><title>${d.date}: ${d.n}</title></circle>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12" fill="#A78BFA">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8B5CF6" stop-opacity=".35"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></linearGradient></defs>
<rect width="${W}" height="${H}" rx="8" fill="#0D0221"/>
<text x="${W / 2}" y="20" text-anchor="middle" font-size="14" fill="#E9D5FF">${user}'s contributions — last ${DAYS} days</text>
${grid}${labels}
<polygon points="${x(0)},${y(0)} ${pts.join(" ")} ${x(DAYS - 1)},${y(0)}" fill="url(#g)"/>
<polyline points="${pts.join(" ")}" fill="none" stroke="#8B5CF6" stroke-width="2.5" stroke-linejoin="round"/>
${dots}
</svg>
`;
mkdirSync("profile", { recursive: true });
writeFileSync("profile/activity-graph.svg", svg);
console.log("ok", days.reduce((s, d) => s + d.n, 0), "contributions");
