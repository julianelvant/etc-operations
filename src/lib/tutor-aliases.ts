/** Map messy Excel / free-text tutor names to canonical schedule names. */
const ALIAS_TO_CANONICAL: Record<string, string> = {
  "amir darwish": "Amir Darwich",
  "amir darwich": "Amir Darwich",
  "charbel abou youness": "Charbel Abou Younes",
  "charbel abou younes": "Charbel Abou Younes",
  "charbel attieh": "Charbel Attieh",
  "charbel gebrael": "Charbel Gebrael",
  "george bou saba": "George Bou Saba",
  "issa el agha": "Issa al agha",
  "issa al agha": "Issa al agha",
  "jad hayek": "Jad Al Hayek",
  "jad al hayek": "Jad Al Hayek",
  "jana salman": "Jana Salman",
  "josee korkomaz": "Josee Korkomaz",
  "julia choucair": "Julia Choucair",
  "kassem el moussawi": "Kassem El Moussawi",
  "kassem mousawi": "Kassem El Moussawi",
  "lea hazimeh": "Lea Hazimeh",
  "lilly al riachy": "Lilly Jarir Al Riachy",
  "lilly jarir al riachy": "Lilly Jarir Al Riachy",
  "lynn hammoud": "Lynn Hammoud",
  "lynn hammound": "Lynn Hammoud",
  "majd jaffal": "Majd Jaffal",
  "majd shatila": "Majd Shatila",
  "majd chatila": "Majd Shatila",
  "maykel tohme": "Maykel Tohme",
  "michael tohme": "Maykel Tohme",
  "mohamed mahmoud chebbo": "Mohamed Mahmoud Chebbo",
  "mohammad chebbo": "Mohamed Mahmoud Chebbo",
  "nour hammoud": "Nour Hammoud",
  "rami chahine": "Rami Chahine",
  "ranim khattar": "Ranim Khattar",
  "yara sleem": "Yara Sleem",
  "yara slim": "Yara Sleem",
  "zaynab moussawi": "Zaynab Moussawi",
  "zainab moussawi": "Zaynab Moussawi",
  "zeina el zein": "Zeina El Zein",
  "zeina al zein": "Zeina El Zein",
  // Walk-ins / one-offs kept as their own names (normalized casing via import)
  "ahmad abbas": "Ahmad Abbas",
  "ali sobh": "Ali Sobh",
  "ghadi dbouk": "Ghadi Dbouk",
  "jad mchaimech": "Jad Mchaimech",
  "jinan saydeldine": "Jinan Saydeldine",
  "roudy haddad": "Roudy Haddad",
  "wael tabbara": "Wael Tabbara",
  "yorgo azie": "Yorgo Azie",
};

export function normalizeTutorKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve Excel/free-text name to canonical tutor display name when known. */
export function canonicalTutorName(raw: string): string {
  const key = normalizeTutorKey(raw);
  return ALIAS_TO_CANONICAL[key] ?? raw.trim();
}
