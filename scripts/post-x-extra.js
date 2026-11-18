import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { TwitterApi } from "twitter-api-v2";

const START = "2026-11-18";
const END = "2026-11-24";
const DAY = 86_400_000;
const TOPICS = ["consultation", "equity", "consolidation"];
const IMAGES = {
  consultation: ["tanpo-card", "個人・法人の不動産を活用した資金調達の相談案内。"],
  equity: ["tanpo-equity-diagram", "住宅ローン残債、不動産評価、追加融資や借り換えの検討を示す図。"],
  consolidation: ["tanpo-consolidation-diagram", "複数の借入をまとめる場合に、月々の返済、総返済額、担保リスクを比較する図。"],
};

const COPY = [
  [
    "個人・法人所有の不動産について、多様な資金使途に対して柔軟な対応・相談が可能です。可否は借入先の商品条件と審査によります。",
    "住宅ローンを返済してきた方へ。現在の残債と物件評価を確認すると、追加融資や借り換えを検討できる場合があります。融資可否・金額は個別審査です。",
    "住宅・カード・教育・マイカーローンを返済中の方へ。対象商品で一本化できる場合があります。月額・総返済額を比べ、担保を失うリスクも確認を。",
  ],
  [
    "学費など、まとまった支出で不動産を活用する場合、まず商品の資金使途と返済に回せる金額を確認しましょう。",
    "残債が減っていても、評価額との差額をそのまま借りられるわけではありません。借入先の担保評価、抵当権、返済能力が確認項目です。",
    "一本化で月々の返済が減っても、期間が延びれば総返済額が増える場合があります。担保を失うリスクも含めて比較しましょう。",
  ],
  [
    "会社所有の不動産を資金調達に活用したいときは、登記上の名義、既存の担保、必要額、返済計画を整理しておくと相談が進めやすくなります。",
    "購入時の価格と、現在の担保評価は異なる場合があります。住宅ローンの残高証明と物件情報を揃え、資金調達の余地を確認しましょう。",
    "一本化の比較表には、既存ローンの繰上返済手数料と新たな登記費用も。月額、総返済額、返済不能時の担保リスクを確認しましょう。",
  ],
  [
    "つなぎ資金の相談では、必要な日と入金予定日を整理しましょう。返済に充てる入金が遅れた場合の対応も確認項目です。",
    "既存の住宅ローンを残して追加融資を検討する場合、抵当権の順位や既存契約を確認しましょう。対応の可否は借入先によります。",
    "教育ローンなどを一本化する前に、どの借入が対象になるかを確認しましょう。返済月額と総返済額に加え、追加する担保のリスクも比較を。",
  ],
  [
    "個人名義の不動産を会社の資金調達に活用する場合、借入名義、担保提供者、契約で認められる資金使途を確認しましょう。",
    "不動産評価が上がった場合でも、追加融資の可否は既存借入や返済能力を含む個別審査で決まります。借り換えの諸費用も確認しましょう。",
    "一本化の商品を比較するときは、固定・変動金利の違いも確認を。金利が変わる場合の月額と総返済額、担保を失うリスクまで検討しましょう。",
  ],
  [
    "急ぎの資金相談では、必要日、金額、物件情報を先に整理しましょう。審査の所要日数と実行時期は借入先の条件によります。",
    "追加融資と借り換えで条件を見比べる際は、今の住宅ローンの契約と新しい借入の返済計画を準備しましょう。融資可否は審査で決まります。",
    "完済間近の借入を一本化すると、返済期間が延びる場合があります。対象を変えたときの月額・総返済額と、担保のリスクを確認しましょう。",
  ],
  [
    "不動産担保ローンで利息のみを払う期間がある場合、その間は元金が減りません。満期の返済方法と返済原資を確認しましょう。",
    "担保余力を確認するときは、残債の最新額と借入先の担保評価が出発点です。希望額を借りられるかは、返済計画も含めて個別に確認します。",
    "一本化の判断前に、今の借入を続ける場合と借り換えた場合を比較しましょう。月額、完済までの費用、返済不能時の担保処分が確認項目です。",
  ],
];

const jstDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short" });

export function selectPost(now, slot) {
  if (![1, 2, 3].includes(slot)) throw new Error("Invalid X slot");
  const date = jstDate.format(now);
  if (date < START || date > END) return null;
  const day = (Date.parse(date) - Date.parse(START)) / DAY;
  const topic = TOPICS[slot - 1];
  const [image, alt] = IMAGES[topic];
  const url = new URL("https://fudousan-tanpo.tokyo/");
  url.search = new URLSearchParams({
    utm_source: "x",
    utm_medium: "organic_social",
    utm_campaign: "tanpo_2026_yearend",
    utm_content: `${topic}_${date}`,
  }).toString();
  const body = COPY[day][slot - 1];
  if ([...body].length * 2 + 25 > 280) throw new Error("X message exceeds weighted limit");
  return { date, slot, topic, body, url: url.href, image, alt };
}

function readImage(post) {
  const image = readFileSync(new URL(`../assets/${post.image}.png`, import.meta.url));
  if (image.length < 24 || image.length > 5 * 1024 * 1024 ||
      image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Invalid PNG image");
  }
  return image;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

let phase = "validation";
try {
  if (process.env.DRY_RUN === "1") {
    const bodies = new Set();
    for (let time = Date.parse(START); time <= Date.parse(END); time += DAY) {
      for (const slot of [1, 2, 3]) {
        const post = selectPost(new Date(time), slot);
        if (bodies.has(post.body)) throw new Error("Duplicate copy");
        bodies.add(post.body);
        console.log(JSON.stringify({ ...post, pngBytes: readImage(post).length }));
      }
    }
  } else {
    const startedAt = new Date(process.env.X_EVENT_CREATED_AT || "");
    const post = selectPost(new Date(), Number(process.env.X_SLOT));
    if (!post || !Number.isFinite(+startedAt) || jstDate.format(startedAt) !== post.date) {
      console.log("Outside the original JST publishing day or trial window. No post.");
    } else {
      const releaseCheck = process.env.GITHUB_REF === "refs/heads/feature/tanpo-campaign-2026" &&
        process.env.X_RELEASE_VERIFICATION === "1" && post.date === "2026-11-18" && [2, 3].includes(post.slot);
      if (process.env.GITHUB_ACTIONS !== "true" || (process.env.GITHUB_REF !== "refs/heads/main" && !releaseCheck)) {
        throw new Error("Invalid live publishing ref");
      }
      const image = readImage(post);
      const reservation = `refs/tags/tanpo-x-reserved/${post.date}/${post.slot}`;
      phase = "reservation lookup";
      if (git("ls-remote", "--refs", "origin", reservation)) {
        console.log(`Slot already reserved. Verify the original run before any recovery: ${reservation}`);
      } else {
        const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
        if (![X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET].every(Boolean)) {
          throw new Error("Missing X credentials");
        }
        const x = new TwitterApi({
          appKey: X_APP_KEY, appSecret: X_APP_SECRET,
          accessToken: X_ACCESS_TOKEN, accessSecret: X_ACCESS_SECRET,
        }).readWrite;
        phase = "media upload";
        const mediaId = await x.v1.uploadMedia(image, { mimeType: "image/png" });
        phase = "alt text";
        await x.v1.createMediaMetadata(mediaId, { alt_text: { text: post.alt } });
        phase = "reservation";
        // Keep the reservation on every post attempt, including ambiguous API failures.
        execFileSync("gh", [
          "api", "--method", "POST", `repos/${process.env.GITHUB_REPOSITORY}/git/refs`,
          "-f", `ref=${reservation}`, "-f", `sha=${process.env.GITHUB_SHA}`,
        ], { stdio: "pipe" });
        phase = "create post";
        const { data } = await x.v2.tweet({
          text: post.body + "\n\n" + post.url,
          media: { media_ids: [mediaId] },
        });
        if (!/^\d+$/.test(data?.id ?? "")) throw new Error("Missing X post ID");
        console.log(JSON.stringify({ status: "posted", ...post, publicUrl: `https://x.com/i/web/status/${data.id}` }));
      }
    }
  }
} catch (error) {
  const status = Number.isInteger(error.code) ? ` (code ${error.code})` : "";
  console.error(`X publishing failed at ${phase}${status}. Inspect the original run before retrying.`);
  process.exitCode = 1;
}
