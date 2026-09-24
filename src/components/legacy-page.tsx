import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LegacyRuntime } from "@/components/legacy-runtime";
import type { LegacySlug } from "@/lib/legacy-routes";

const applyNovaBrand = (content: string) => content
  .replaceAll("START YOUR HYPE.", "START YOUR ROUND.")
  .replaceAll("READY TO TURN IT UP?", "STRONGER EVERY ROUND.")
  .replaceAll("FOUR WAYS TO<br>TURN IT UP.", "FOUR WAYS TO<br>GET STRONGER.")
  .replaceAll("CHOOSE YOUR HYPE.", "CHOOSE YOUR PATH.")
  .replaceAll('href="mailto:hypetraininglab@gmail.com"', 'href="trial.html"')
  .replaceAll("https://www.google.com/maps?q=336%2F18%20Nguy%E1%BB%85n%20V%C4%83n%20Lu%C3%B4ng%2C%20Ph%C6%B0%E1%BB%9Dng%20Ph%C3%BA%20L%C3%A2m%2C%20TP.%20H%E1%BB%93%20Ch%C3%AD%20Minh&output=embed", "about:blank")
  .replaceAll("336/18 Nguyễn Văn Luông, Phường Phú Lâm, TP. Hồ Chí Minh", "Địa chỉ sẽ được cập nhật")
  .replaceAll("0909 995 702", "Hotline sẽ được cập nhật")
  .replaceAll("hypetraininglab@gmail.com", "Email sẽ được cập nhật")
  .replaceAll("HYPE Training Lab", "NOVA TRAINING LAB")
  .replaceAll("HYPER", "NOVA CREW")
  .replaceAll("HYPE", "NOVA")
  .replaceAll("Turn It Up", "Stronger Every Round")
  .replaceAll("TURN IT UP", "STRONGER EVERY ROUND");

export function readLegacyPage(slug: LegacySlug) {
  const html = readFileSync(join(process.cwd(), "src", "content", "templates", `${slug}.html`), "utf8");
  let main = html.match(/<main>([\s\S]*?)<\/main>/)?.[1];
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const page = html.match(/<body data-page="([^"]+)"/)?.[1];

  if (!main || !title || !page) {
    throw new Error(`Không đọc được cấu trúc ${slug}.html`);
  }

  main = main
    .replaceAll("assets/video/hype-hero.mp4", "assets/video/nova-hero.mp4")
    .replaceAll("assets/images/boxing-bag.webp", "assets/images/nova/boxing-bag.jpg")
    .replaceAll("assets/images/boxing-blue.webp", "assets/images/nova/boxing-blue.jpg")
    .replaceAll("assets/images/boxing-class.webp", "assets/images/nova/boxing-class.jpg")
    .replaceAll("assets/images/boxing-coach.webp", "assets/images/nova/boxing-coach.jpg")
    .replaceAll("assets/images/boxing-drill.webp", "assets/images/nova/boxing-drill.jpg")
    .replaceAll("assets/images/boxing-power.webp", "assets/images/nova/boxing-power.jpg")
    .replaceAll("assets/images/boxing-team.webp", "assets/images/nova/boxing-team.jpg")
    .replaceAll("assets/images/boxing-technique.webp", "assets/images/nova/boxing-technique.png")
    .replaceAll("assets/images/coach-action.webp", "assets/images/nova/coach-action.jpg")
    .replaceAll("assets/images/conditioning-agility.webp", "assets/images/nova/hyrox-sled.jpg")
    .replaceAll("assets/images/conditioning-group.webp", "assets/images/nova/hyrox-event.jpg")
    .replaceAll("assets/images/conditioning-line.webp", "assets/images/nova/hyrox-ropes.jpg")
    .replaceAll("assets/images/conditioning-warmup.webp", "assets/images/nova/hyrox-race.png")
    .replaceAll("assets/images/community-champions.webp", "assets/images/nova/bjj-belt-quote.png")
    .replaceAll("assets/images/community-class.webp", "assets/images/nova/bjj-throw-blur.jpg")
    .replaceAll("assets/images/community-ring.webp", "assets/images/nova/bjj-takedown.jpg")
    .replaceAll("assets/images/community-wide.webp", "assets/images/nova/bjj-belt.jpg")
    .replaceAll("assets/images/groupx-coach.webp", "assets/images/nova/bjj-movement.jpg")
    .replaceAll("assets/images/groupx-woman.webp", "assets/images/nova/bjj-guard.jpg")
    .replace(/<section class="section dark-2"><div class="container split"><div class="split-media"><img src="assets\/images\/locker\.webp"[\s\S]*?<\/section>/g, "")
    .replace(/<a\b[^>]*\bhref="(?:location|shop|community)\.html"[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/(<a\b[^>]*\bclass="[^"]*\bbtn\b[^"]*"[^>]*\bhref=")(?:classes\.html|recovery\.html#booking)(">\s*(?:Đăng ký|Đặt)[^<]*<\/a>)/g, "$1trial.html$2")
    .replaceAll('href="classes.html">Đăng ký lớp mới</a>', 'href="trial.html">Đăng ký lớp mới</a>')
    .replaceAll('href="register.html">Tạo tài khoản My HYPE</a>', 'href="trial.html">Nhận tư vấn từ NOVA</a>')
    .replace(/<button data-dashboard-tab="events">[\s\S]*?<\/button>/g, "")
    .replace(/<section data-dashboard-panel="events"[^>]*>[\s\S]*?<\/section>/g, "");

  return {
    main: applyNovaBrand(main),
    title: applyNovaBrand(title),
    description: description ? applyNovaBrand(description) : description,
    page,
  };
}

export function LegacyPage({ slug }: { slug: LegacySlug }) {
  const page = readLegacyPage(slug);

  return (
    <>
      <div data-site-header />
      <main dangerouslySetInnerHTML={{ __html: page.main }} />
      <div data-site-footer />
      <LegacyRuntime page={page.page} />
    </>
  );
}
