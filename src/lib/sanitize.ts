/** Cleans text that came from a file or a form before it is stored or sent anywhere. */
export function cleanText(input: string, max = 200): string {
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
