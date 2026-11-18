const CRISIS =
  /\b(suicid(e|al)|kill myself|killing myself|want to die|end my life|self[- ]?harm|cut myself|overdose)\b/i;

export function detectCrisis(texts: string[]): boolean {
  return texts.some((t) => CRISIS.test(t));
}

export const CRISIS_COPY = {
  title: "You're not alone",
  body: "Some of what you wrote sounds heavy. This is not a moment for coaching. If you are in immediate danger, contact local emergency services. In the US and Canada you can call or text 988. If you want, you can come back to a check-in when you have more support around you.",
  resources: [
    { label: "988 Suicide & Crisis Lifeline", href: "https://988lifeline.org" },
    { label: "International Association for Suicide Prevention", href: "https://www.iasp.info/suicidalthoughts/" },
  ],
};
