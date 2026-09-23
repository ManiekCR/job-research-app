import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "./actions";

// Pré-remplissage basé sur ton CV — à affiner/corriger directement dans le formulaire.
const DEFAULT_CV = {
  name: "Marian Caron",
  location: "Berlin, Germany",
  email: "caron.marian@gmail.com",
  linkedin: "linkedin.com/in/mariancaron",
  headline:
    "Technical, customer-facing professional with 10+ years across fintech, travel, and SaaS",
  summary:
    "Technical, customer-facing professional with 10+ years of experience across fintech, travel, and SaaS environments, complemented by a full-stack web development bootcamp (Le Wagon, 2019). Skilled at translating technical concepts into clear, actionable guidance for technical and non-technical audiences alike, and at bridging customer insight with product and engineering priorities.",
  work_authorization: "Eligible to work in Germany / EU",
  languages: [
    { name: "French", level: "Native" },
    { name: "English", level: "Professional Proficiency" },
    { name: "German", level: "B1" },
  ],
  core_skills: [
    "Customer Operations & Voice-of-Customer Analysis",
    "Cross-functional Stakeholder Management (Product, Engineering, Sales, Design)",
    "Technical Troubleshooting & Problem-Solving",
    "Requirements Gathering & Feature Discovery",
    "Process Improvement & Product Feedback Loops",
    "Data-Informed Decision Making",
    "Simplifying Complex Technical Concepts for Non-Technical Audiences",
    "Agile / Scrum Workflows",
  ],
  tools: ["Jira", "Figma", "GitHub", "Salesforce", "Slack", "Notion", "Typeform", "Zoom"],
  technical_skills: ["APIs & Scripting fundamentals", "Ruby on Rails", "JavaScript", "React", "SQL"],
  experience: [
    {
      title: "Booking Success Specialist",
      company: "Tourlane",
      location: "Berlin",
      start: "2023-07",
      end: null,
      highlights: [
        "Act as the technical point of contact between customers, travel partners, and internal teams to resolve booking issues and product questions.",
        "Explain booking system functionality and workflows clearly to customers and partners with varying technical backgrounds.",
        "Identify recurring technical issues and feed findings back to internal teams to drive process and product improvements.",
      ],
    },
    {
      title: "Product Business Analyst – Cards, Accounts & Credit",
      company: "Vivid Money",
      location: "Berlin",
      start: "2021-06",
      end: "2022-08",
      highlights: [
        "Served as a technical liaison between engineering, product, legal, and design teams.",
        "Owned end-to-end feature delivery, from discovery to go-live, including technical scoping.",
        "Reduced card production costs by 40% by launching a personalized card product.",
        "Delivered a 17% revenue increase in one month through Prime Subscription improvements.",
      ],
    },
    {
      title: "Customer Service Expert",
      company: "Vivid Money",
      location: "Berlin",
      start: "2021-01",
      end: "2021-05",
      highlights: ["Achieved 95% customer satisfaction resolving technical and account-related inquiries."],
    },
    {
      title: "B2B Customer Support Specialist",
      company: "SumUp",
      location: "Berlin",
      start: "2020-03",
      end: "2020-09",
      highlights: [
        "Provided technical B2B support to merchants using Salesforce.",
        "Monitored transactions to identify suspicious activity and potential fraud cases.",
      ],
    },
    {
      title: "Booking Success Specialist / Customer Support",
      company: "Booking.com",
      location: "Berlin",
      start: "2015-12",
      end: "2019-07",
      highlights: [
        "Supported hotel partners and guests with technical platform and booking-related issues.",
        "Achieved 91% customer satisfaction across high-volume technical support interactions.",
      ],
    },
  ],
  education: [
    { title: "German Language Certificate B1", school: "Volkshochschule Pankow, Berlin", period: "2025–2026" },
    {
      title: "Full-Stack Web Development Bootcamp",
      school: "Le Wagon, Berlin",
      period: "2019",
      details: "9-week intensive: Ruby on Rails, HTML, CSS/SCSS, JavaScript, APIs, databases.",
    },
    { title: "BTS MUC (Management)", school: "LICP Tourcoing, France", period: "2011–2013" },
  ],
  target_roles: [
    "Solutions Engineer",
    "Associate Solutions Engineer",
    "Customer Success Manager / Engineer",
    "Technical Account Manager",
    "Implementation / Onboarding Specialist",
    "Product Operations / Business Analyst",
    "Product Specialist / Product Support",
    "Junior Software / Fullstack Engineer",
/*     "Backend Engineer",
    "Frontend Engineer",  */
    "Technical Support Engineer",
/*     "Backend Developer",
    "Frontend Developer",   
    "Fullstack Developer", */
  ],
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profile")
    .select("cv_json")
    .eq("user_id", user!.id)
    .maybeSingle();

  const hasSavedCv =
    profile?.cv_json && Object.keys(profile.cv_json as object).length > 0;
  const currentJson = JSON.stringify(hasSavedCv ? profile!.cv_json : DEFAULT_CV, null, 2);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Profil — CV maître
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Seule source utilisée pour le scoring et la génération de CV/lettres.
        {!hasSavedCv && " Pré-rempli à partir de ton CV — relis et corrige avant d'enregistrer."}
      </p>

      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Profil enregistré.
        </p>
      )}

      <form action={saveProfile} className="mt-6 flex flex-col gap-4">
        <textarea
          name="cvJson"
          rows={28}
          defaultValue={currentJson}
          spellCheck={false}
          className="rounded border border-black/10 bg-transparent p-3 font-mono text-xs dark:border-white/10"
        />
        <button
          type="submit"
          className="self-start rounded bg-foreground px-3 py-2 text-background"
        >
          Enregistrer
        </button>
      </form>
    </div>
  );
}