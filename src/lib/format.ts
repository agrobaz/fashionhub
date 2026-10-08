import type { Condition } from "./types";

export function formatPrice(n: number): string {
  return "UGX " + n.toLocaleString("en-US");
}

export function conditionLabel(c: Condition | null): string {
  if (c === "like_new") return "Like new";
  if (c === "good") return "Good";
  if (c === "fair") return "Fair";
  return "";
}

export function whatsappLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "256" + digits.slice(1);
  return "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return "Something went wrong. Try again.";
}
