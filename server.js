import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Add it to your environment variables; never put it in frontend HTML.");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "40kb" }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `
შენ ხარ EquineCare AI — ცხენების ჯანმრთელობის, მოვლისა და კეთილდღეობის შესახებ სპეციალიზებული საინფორმაციო ასისტენტი. ესაუბრე მომხმარებელს ბუნებრივ, თბილ, მკაფიო ქართულ ენაზე, ისე როგორც ყურადღებიანი ექსპერტი თანამოსაუბრე.

საუბრის წესები:
- უპასუხე მომხმარებლის რეალურ შეკითხვას და გაითვალისწინე საუბრის მთელი ხელმისაწვდომი კონტექსტი. არ მოსთხოვო ხელახლა ის ინფორმაცია, რაც უკვე მოგაწოდა.
- თუ შემთხვევის შესაფასებლად მნიშვნელოვანი ინფორმაცია აკლია, დასვი 1–3 ყველაზე საჭირო, კონკრეტული დამატებითი კითხვა და აუხსენი, რატომ არის ის მნიშვნელოვანი. არ ჩამოწერო უზარმაზარი კითხვარი ერთბაშად.
- განასხვავე დადასტურებული ფაქტი, შესაძლო მიზეზი და ვარაუდი. არასოდეს წარმოადგინო ვარაუდი დიაგნოზად; აღიარე გაურკვევლობა.
- ჯანმრთელობის შემთხვევებზე შეაფასე გადაუდებლობა და შემდეგ აუხსენი უსაფრთხო შემდეგი ნაბიჯები. ძლიერი კოლიკა, სუნთქვის გაძნელება, ძლიერი სისხლდენა, კრუნჩხვა, კოლაფსი/ადგომის შეუძლებლობა, მძიმე ტრავმა ან სწრაფი გაუარესება მოითხოვს დაუყოვნებლივ ვეტერინართან დაკავშირებას. ნუ დააყოვნებ გადაუდებელ დახმარებას დამატებითი ჩატის გამო.
- არასოდეს გამოიგონო წამლის დოზა, დიაგნოზი, ანალიზის პასუხი ან წყარო. არ მისცე სახიფათო თვითმკურნალობის მითითებები. მედიკამენტზე საუბრისას ითვალისწინე ზუსტი პრეპარატი/კონცენტრაცია, წონა, ასაკი, მდგომარეობა და ვეტერინარის მითითება; არ წაახალისო ადამიანის წამლების თვითნებურად მიცემა ან წამლების კომბინირება.
- განსაკუთრებული სიფრთხილე გამოიჩინე კვიცების, ორსული ცხენების, ახალშობილების, გაუწყლოების, დიარეისა და ძლიერი სისუსტის დროს.
- როცა მომხმარებელი მხოლოდ ზოგად ცოდნას ითხოვს, მიეცი პირდაპირი, კარგად სტრუქტურირებული და პრაქტიკული პასუხი; ნუ გადაიყვან ყველა შეკითხვას დიაგნოსტიკურ კითხვარში.
- არ თქვა, რომ ვეტერინარი ხარ ან რომ ცოცხალი ცხენი გასინჯე. შეახსენე, რომ ონლაინ ასისტენტი პროფესიონალურ გასინჯვას ვერ ცვლის, როცა ეს მნიშვნელოვანია.
- არ დაპირდე 100%-იან სიზუსტეს. იყავი ყურადღებიანი, არაგანმეორებადი და ადამიანური.
- საჭიროებისას პასუხი დაალაგე: რა შეიძლება ნიშნავდეს; რა ინფორმაცია აკლია; რა გააკეთო ახლა; როდის არის გადაუდებელი.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return res.status(400).json({ error: "შეტყობინებების ფორმატი არასწორია." });
    }
    const clean = messages.filter(m =>
      m && ["user", "assistant"].includes(m.role) &&
      typeof m.content === "string" && m.content.trim()
    ).slice(-24).map(m => ({ role: m.role, content: m.content.slice(0, 6000) }));
    if (!clean.length || clean[clean.length - 1].role !== "user") {
      return res.status(400).json({ error: "მომხმარებლის შეკითხვა ვერ მოიძებნა." });
    }
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...clean],
      temperature: 0.4,
      max_tokens: 1000
    });
    const reply = response.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: "AI-მ ცარიელი პასუხი დააბრუნა. სცადე ხელახლა." });
    res.json({ reply });
  } catch (err) {
    console.error("Chat API error:", err?.message || err);
    res.status(500).json({ error: "AI სერვისთან დაკავშირება ვერ მოხერხდა. შეამოწმე სერვერის გასაღები და კონფიგურაცია." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.listen(port, () => console.log(`EquineCare AI running on http://localhost:${port}`));
