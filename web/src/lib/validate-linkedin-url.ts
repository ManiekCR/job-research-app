// Allows https://linkedin.com/in/... or https://<country subdomain>.linkedin.com/in/...
// (e.g. de.linkedin.com), with or without "www.", with or without a trailing "/".
const LINKEDIN_PROFILE_URL = /^https:\/\/(www\.|[a-z]{2,3}\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/i;

export function isValidLinkedinProfileUrl(url: string): boolean {
  return LINKEDIN_PROFILE_URL.test(url.trim());
}
