import fs from "fs/promises";
import path from "path";

export interface SkillMeta {
  name: string;
  description: string;
  category: string;
  dir: string;
}

interface ParsedSkill {
  meta: SkillMeta;
  content: string;
}

function parseFrontmatter(raw: string): { attrs: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { attrs: {}, body: raw };

  const attrs: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    attrs[key] = val;
  }
  return { attrs, body: match[2] };
}

export async function loadSkills(skillsDir: string): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return skills;
  }

  for (const entry of entries) {
    const skillFile = path.join(skillsDir, entry, "SKILL.md");
    try {
      const raw = await fs.readFile(skillFile, "utf-8");
      const { attrs } = parseFrontmatter(raw);
      skills.push({
        name: attrs.name || entry,
        description: attrs.description || "",
        category: attrs.category || "general",
        dir: entry,
      });
    } catch {
      // skip directories without a valid SKILL.md
    }
  }

  return skills;
}

export async function readSkill(skillsDir: string, name: string): Promise<string | null> {
  const skills = await loadSkills(skillsDir);
  const skill = skills.find((s) => s.name === name || s.dir === name);
  if (!skill) return null;

  const skillFile = path.join(skillsDir, skill.dir, "SKILL.md");
  try {
    const raw = await fs.readFile(skillFile, "utf-8");
    const { body } = parseFrontmatter(raw);
    return body;
  } catch {
    return null;
  }
}
