// Liens d'apprentissage curés, chaque URL vérifiée manuellement (requête
// réelle, code 200) avant ajout. Le LLM ne doit jamais inventer une URL —
// si une compétence manquante n'est pas dans cette liste, on retombe sur
// un lien de recherche généré (YouTube/Coursera), jamais sur une page
// inventée pour l'occasion.
export const CURATED_LEARNING_RESOURCES: Record<string, { label: string; url: string }[]> = {
  sql: [{ label: "roadmap.sh — SQL", url: "https://roadmap.sh/sql" }],
  python: [{ label: "roadmap.sh — Python", url: "https://roadmap.sh/python" }],
  javascript: [{ label: "roadmap.sh — JavaScript", url: "https://roadmap.sh/javascript" }],
  typescript: [{ label: "Documentation TypeScript", url: "https://www.typescriptlang.org/docs/" }],
  react: [{ label: "Documentation React", url: "https://react.dev/learn" }],
  "next.js": [{ label: "Next.js Learn", url: "https://nextjs.org/learn" }],
  nextjs: [{ label: "Next.js Learn", url: "https://nextjs.org/learn" }],
  rails: [{ label: "Ruby on Rails Guides", url: "https://guides.rubyonrails.org/" }],
  git: [{ label: "Documentation Git", url: "https://git-scm.com/doc" }],
  api: [{ label: "roadmap.sh — API Design", url: "https://roadmap.sh/api-design" }],
  salesforce: [{ label: "Salesforce Trailhead", url: "https://trailhead.salesforce.com/" }],
  scrum: [{ label: "Atlassian — Scrum", url: "https://www.atlassian.com/agile/scrum" }],
  agile: [{ label: "Atlassian — Agile", url: "https://www.atlassian.com/agile" }],
  aws: [{ label: "Documentation AWS", url: "https://docs.aws.amazon.com/" }],
  docker: [{ label: "Docker — Prise en main", url: "https://docs.docker.com/get-started/" }],
  postgresql: [{ label: "Tutoriel PostgreSQL", url: "https://www.postgresql.org/docs/current/tutorial.html" }],
  "product management": [{ label: "ProductPlan — Ressources", url: "https://www.productplan.com/learn/" }],
  zendesk: [{ label: "Centre d'aide Zendesk", url: "https://support.zendesk.com/hc/en-us" }],
  hubspot: [{ label: "HubSpot Academy", url: "https://academy.hubspot.com/" }],
  jira: [{ label: "Guides Jira", url: "https://www.atlassian.com/software/jira/guides" }],
  figma: [{ label: "Centre d'aide Figma", url: "https://help.figma.com/hc/en-us" }],
};

export function findLearningResources(skill: string): { label: string; url: string }[] {
  const normalized = skill.toLowerCase();
  for (const [key, resources] of Object.entries(CURATED_LEARNING_RESOURCES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return resources;
    }
  }
  // Repli : liens de recherche générés (jamais une URL inventée pour une
  // page précise) — conforme au plan initial.
  const query = encodeURIComponent(skill);
  return [
    { label: `Chercher "${skill}" sur YouTube`, url: `https://www.youtube.com/results?search_query=${query}` },
    { label: `Chercher "${skill}" sur Coursera`, url: `https://www.coursera.org/search?query=${query}` },
  ];
}