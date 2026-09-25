// Autorise https://linkedin.com/in/... ou https://<sous-domaine pays>.linkedin.com/in/...
// (ex. de.linkedin.com), avec ou sans "www.", avec ou sans "/" final.
const LINKEDIN_PROFILE_URL = /^https:\/\/(www\.|[a-z]{2,3}\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/i;

export function isValidLinkedinProfileUrl(url: string): boolean {
  return LINKEDIN_PROFILE_URL.test(url.trim());
}
