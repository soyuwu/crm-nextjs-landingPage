import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

const DEFAULT_LEAD_WEBHOOK_URL =
  "https://soyuwu.app.n8n.cloud/webhook-test/20009082-6b20-4042-a6fa-5aeb817a45c9";

const ageGroups = {
  "18-22": "18 - 22",
  "23-30": "23 - 30",
  "31-40": "31 - 40",
  "40+": "Trên 40",
} as const;

const goals = {
  weight_loss: "Giảm cân",
  muscle_gain: "Tăng cơ",
  fitness: "Nâng cao sức khỏe",
  sports_performance: "Cải thiện thể lực thể thao",
  rehabilitation: "Phục hồi vận động",
} as const;

const budgets = {
  "<1m": "Dưới 1 triệu",
  "1-3m": "1 - 3 triệu",
  "3-5m": "3 - 5 triệu",
  "5m+": "Trên 5 triệu",
} as const;

const startTimes = {
  today: "Ngay hôm nay",
  this_week: "Trong tuần này",
  this_month: "Trong tháng này",
  just_looking: "Chỉ tìm hiểu trước",
} as const;

const workoutFrequencies = {
  "1-2": "1 - 2 buổi/tuần",
  "3-4": "3 - 4 buổi/tuần",
  "5-6": "5 - 6 buổi/tuần",
  daily: "Gần như mỗi ngày",
} as const;

const preferredTimes = {
  "": "",
  "06-10": "06:00 - 10:00",
  "10-16": "10:00 - 16:00",
  "16-19": "16:00 - 19:00",
  "19-22": "19:00 - 22:00",
} as const;

const consentSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === "yes" || value === "true");

const emailSchema = z.union([z.literal(""), z.string().trim().email().max(254)]);

const leadSchema = z
  .object({
    leadType: z.enum(["trial", "consultation", "contact", "newsletter"]).default("trial"),
    name: z.string().trim().max(120).optional().default(""),
    phone: z.string().trim().max(30).optional().default(""),
    email: emailSchema.optional().default(""),
    age_group: z.enum(["18-22", "23-30", "31-40", "40+"]).optional(),
    goal: z.enum(["weight_loss", "muscle_gain", "fitness", "sports_performance", "rehabilitation"]).optional(),
    budget: z.enum(["<1m", "1-3m", "3-5m", "5m+"]).optional(),
    start_time: z.enum(["today", "this_week", "this_month", "just_looking"]).optional(),
    workout_frequency: z.enum(["1-2", "3-4", "5-6", "daily"]).optional(),
    preferred_time: z.enum(["", "06-10", "10-16", "16-19", "19-22"]).optional().default(""),
    note: z.string().trim().max(1500).optional().default(""),
    source: z.string().trim().max(300).optional().default("Website"),
    policy: consentSchema.optional().default(false),
    marketing: consentSchema.optional().default(false),
    website: z.string().trim().max(200).optional().default(""),
  })
  .superRefine((lead, context) => {
    if (lead.website) return;

    if (lead.leadType === "newsletter") {
      if (!lead.email) {
        context.addIssue({ code: "custom", message: "Email là bắt buộc" });
      }
      return;
    }

    if (!lead.name) context.addIssue({ code: "custom", message: "Họ và tên là bắt buộc" });
    if (!lead.phone) context.addIssue({ code: "custom", message: "Số điện thoại là bắt buộc" });
    if (!lead.email) context.addIssue({ code: "custom", message: "Email là bắt buộc" });
    if (!lead.policy) context.addIssue({ code: "custom", message: "Cần đồng ý xử lý dữ liệu" });

    if (lead.leadType === "trial") {
      for (const field of ["age_group", "goal", "budget", "start_time", "workout_frequency"] as const) {
        if (!lead[field]) context.addIssue({ code: "custom", path: [field], message: "Trường này là bắt buộc" });
      }
    }
  });

const attempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip: string) {
  const now = Date.now();
  const attempt = attempts.get(ip);

  if (!attempt || attempt.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  if (attempt.count >= RATE_LIMIT) return true;
  attempt.count += 1;
  return false;
}

function formatTrialNote(lead: z.infer<typeof leadSchema>) {
  const details = [
    `Độ tuổi: ${ageGroups[lead.age_group!]}`,
    `Mục tiêu: ${goals[lead.goal!]}`,
    `Ngân sách dự kiến: ${budgets[lead.budget!]}`,
    `Thời điểm bắt đầu: ${startTimes[lead.start_time!]}`,
    `Tần suất tập: ${workoutFrequencies[lead.workout_frequency!]}`,
  ];

  if (lead.note) details.push(`Ghi chú: ${lead.note}`);
  return details.join("\n");
}

async function sendLeadWebhook(lead: z.infer<typeof leadSchema>) {
  const webhookUrl = process.env.N8N_LEAD_WEBHOOK_URL || DEFAULT_LEAD_WEBHOOK_URL;
  const payload = {
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    age_group: lead.age_group,
    goal: lead.goal,
    budget: lead.budget,
    start_time: lead.start_time,
    workout_frequency: lead.workout_frequency,
    preferred_time: lead.preferred_time,
    note: lead.note,
    policy: lead.policy,
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Webhook phản hồi HTTP ${response.status}`);
  }
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Vui lòng thử lại sau" },
      { status: 429, headers: { "Retry-After": String(RATE_WINDOW_MS / 1000) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const lead = parsed.data;
  if (lead.website) return NextResponse.json({ ok: true }, { status: 202 });

  const isTrial = lead.leadType === "trial";
  if (isSupabaseConfigured()) {
    const { url, key } = getSupabaseEnv();
    const supabase = createSupabaseClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.rpc("submit_lead", {
      p_lead_type: lead.leadType,
      p_full_name: lead.name,
      p_email: lead.email,
      p_phone: lead.phone,
      p_interest: isTrial ? goals[lead.goal!] : "Bản tin NOVA",
      p_preferred_time: isTrial ? preferredTimes[lead.preferred_time] : "",
      p_note: isTrial ? formatTrialNote(lead) : "Đăng ký nhận bản tin",
      p_source_path: lead.source,
      p_marketing_consent: lead.marketing,
    });

    if (error) {
      return NextResponse.json({ error: "Không thể lưu thông tin" }, { status: 500 });
    }
  }

  try {
    await sendLeadWebhook(lead);
  } catch (error) {
    console.error("Không thể gửi webhook lead", error);
    return NextResponse.json({ error: "Không thể gửi thông tin tư vấn" }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
