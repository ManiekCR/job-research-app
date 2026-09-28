// Curated learning links, each URL manually verified (real request, 200
// status) before being added. The LLM must never invent a URL — if a
// missing skill isn't in this list, we fall back to a generated search
// link (YouTube/Coursera), never a page made up for the occasion.
export const CURATED_LEARNING_RESOURCES: Record<string, { label: string; url: string }[]> = {
  sql: [{ label: "roadmap.sh — SQL", url: "https://roadmap.sh/sql" }],
  python: [{ label: "roadmap.sh — Python", url: "https://roadmap.sh/python" }],
  javascript: [{ label: "roadmap.sh — JavaScript", url: "https://roadmap.sh/javascript" }],
  typescript: [{ label: "TypeScript Documentation", url: "https://www.typescriptlang.org/docs/" }],
  react: [{ label: "React Documentation", url: "https://react.dev/learn" }],
  "next.js": [{ label: "Next.js Learn", url: "https://nextjs.org/learn" }],
  nextjs: [{ label: "Next.js Learn", url: "https://nextjs.org/learn" }],
  rails: [{ label: "Ruby on Rails Guides", url: "https://guides.rubyonrails.org/" }],
  git: [{ label: "Git Documentation", url: "https://git-scm.com/doc" }],
  api: [{ label: "roadmap.sh — API Design", url: "https://roadmap.sh/api-design" }],
  salesforce: [{ label: "Salesforce Trailhead", url: "https://trailhead.salesforce.com/" }],
  scrum: [{ label: "Atlassian — Scrum", url: "https://www.atlassian.com/agile/scrum" }],
  agile: [{ label: "Atlassian — Agile", url: "https://www.atlassian.com/agile" }],
  aws: [{ label: "AWS Documentation", url: "https://docs.aws.amazon.com/" }],
  docker: [{ label: "Docker — Getting Started", url: "https://docs.docker.com/get-started/" }],
  postgresql: [{ label: "PostgreSQL Tutorial", url: "https://www.postgresql.org/docs/current/tutorial.html" }],
  "product management": [{ label: "ProductPlan — Resources", url: "https://www.productplan.com/learn/" }],
  zendesk: [{ label: "Zendesk Help Center", url: "https://support.zendesk.com/hc/en-us" }],
  hubspot: [{ label: "HubSpot Academy", url: "https://academy.hubspot.com/" }],
  jira: [{ label: "Jira Guides", url: "https://www.atlassian.com/software/jira/guides" }],
  figma: [{ label: "Figma Help Center", url: "https://help.figma.com/hc/en-us" }],
};

export function findLearningResources(skill: string): { label: string; url: string }[] {
  const normalized = skill.toLowerCase();
  for (const [key, resources] of Object.entries(CURATED_LEARNING_RESOURCES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return resources;
    }
  }
  // Fallback: generated search links (never a URL invented for a specific
  // page) — in line with the initial plan.
  const query = encodeURIComponent(skill);
  return [
    { label: `Search "${skill}" on YouTube`, url: `https://www.youtube.com/results?search_query=${query}` },
    { label: `Search "${skill}" on Coursera`, url: `https://www.coursera.org/search?query=${query}` },
  ];
}
