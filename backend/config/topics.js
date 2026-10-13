// Quran "topics" are SIRAJ's own keyword shortcuts. Each topic runs a normal keyword search in the
// Sahih International translation, so every result is a real Ayah from the Quran API.
// This is a convenience for finding verses - it is NOT a scholarly classification of the Quran,
// and a keyword match does not always mean the Ayah is "about" the topic.
module.exports = [
  { slug: "patience", label: "Patience", keywords: ["patience", "patient", "persevere"] },
  { slug: "gratitude", label: "Gratitude", keywords: ["grateful", "thankful", "gratitude"] },
  { slug: "forgiveness", label: "Forgiveness & mercy", keywords: ["forgive", "forgiving", "merciful"] },
  { slug: "repentance", label: "Repentance", keywords: ["repent", "repentance", "turn back"] },
  { slug: "trust-in-allah", label: "Trust in Allah", keywords: ["rely upon allah", "trust in allah", "put your trust"] },
  { slug: "prayer", label: "Prayer", keywords: ["establish prayer", "perform prayer", "prayer"] },
  { slug: "charity", label: "Charity", keywords: ["zakah", "spend in the way", "charity"] },
  { slug: "parents", label: "Parents", keywords: ["parents", "your mother", "your father"] },
  { slug: "justice", label: "Justice", keywords: ["justice", "equity", "just"] },
  { slug: "knowledge", label: "Knowledge", keywords: ["knowledge", "those who know", "learn"] },
  { slug: "death-afterlife", label: "Death & the Hereafter", keywords: ["hereafter", "day of resurrection", "every soul will taste death"] },
  { slug: "family", label: "Family & marriage", keywords: ["spouse", "marry", "offspring"] },
];
