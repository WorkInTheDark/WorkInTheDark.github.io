// Nicknames on a public board: up to 20 characters, no links, no markup, no obvious slurs.
// Anything that slips through can be renamed or removed with admin.mjs.
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "retard", "whore", "slut", "rapist", "nazi", "hitler",
  "傻逼", "煞笔", "沙比", "操你", "草你", "肏", "日你", "他妈的", "草泥马", "婊子", "贱人", "鸡巴", "屌", "滚你", "死全家"
];

// Returns the cleaned nickname, "" for none, or null when it can't be used.
export function cleanNick(raw) {
  let s = String(raw === undefined || raw === null ? "" : raw).normalize("NFKC");
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = Array.from(s).slice(0, 20).join("").trim();
  if (/[<>]|https?:|www\.|\.(com|net|org|io|cn|me|xyz|top)\b/i.test(s)) return null;
  const flat = s.toLowerCase().replace(/[\s._\-*]/g, "");
  if (BLOCKED.some(function (w) { return flat.indexOf(w) >= 0; })) return null;
  return s;
}
