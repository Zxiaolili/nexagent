import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { bus } from "../bus/index.js";

export interface ProjectManifest {
  name: string;
  description: string;
  platform: "mobile" | "desktop" | "responsive";
  theme: {
    primary: string;
    bg: string;
    radius: string;
    font: string;
  };
  pages: PageMeta[];
  flows: FlowDef[];
  components: Record<string, ComponentDef>;
}

export interface PageMeta {
  id: string;
  name: string;
  path: string;
  description: string;
  components: string[];
}

export interface FlowDef {
  from: string;
  to: string;
  trigger: string;
  element?: string;
}

export interface ComponentDef {
  props: string[];
  description: string;
}

function defaultManifest(name: string): ProjectManifest {
  return {
    name,
    description: "",
    platform: "mobile",
    theme: {
      primary: "#3B82F6",
      bg: "#FAFAFA",
      radius: "12px",
      font: "Inter",
    },
    pages: [],
    flows: [],
    components: {},
  };
}

export class ProjectManager {
  constructor(private projectsRoot: string) {}

  getProjectDir(projectId: string): string {
    return path.join(this.projectsRoot, projectId);
  }

  private projectDir(projectId: string): string {
    return this.getProjectDir(projectId);
  }

  private manifestPath(projectId: string): string {
    return path.join(this.projectDir(projectId), "nexagent.json");
  }

  private pagesDir(projectId: string): string {
    return path.join(this.projectDir(projectId), "pages");
  }

  async listProjects(): Promise<{ id: string; name: string }[]> {
    await fs.mkdir(this.projectsRoot, { recursive: true });
    const entries = await fs.readdir(this.projectsRoot, {
      withFileTypes: true,
    });
    const projects: { id: string; name: string }[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const manifest = await this.getManifest(entry.name);
        projects.push({ id: entry.name, name: manifest.name });
      } catch {
        // skip invalid
      }
    }
    return projects;
  }

  async createProject(name: string): Promise<string> {
    const projectId = nanoid(10);
    const dir = this.projectDir(projectId);
    await fs.mkdir(path.join(dir, "pages"), { recursive: true });
    await fs.mkdir(path.join(dir, "shared"), { recursive: true });
    const manifest = defaultManifest(name);
    await fs.writeFile(
      this.manifestPath(projectId),
      JSON.stringify(manifest, null, 2),
      "utf-8"
    );
    return projectId;
  }

  async getManifest(projectId: string): Promise<ProjectManifest> {
    const raw = await fs.readFile(this.manifestPath(projectId), "utf-8");
    return JSON.parse(raw);
  }

  async updateManifest(
    projectId: string,
    updater: (m: ProjectManifest) => ProjectManifest
  ): Promise<ProjectManifest> {
    const manifest = await this.getManifest(projectId);
    const updated = updater(manifest);
    await fs.writeFile(
      this.manifestPath(projectId),
      JSON.stringify(updated, null, 2),
      "utf-8"
    );
    bus.emit("project.updated", { projectId });
    return updated;
  }

  async createPage(
    projectId: string,
    name: string,
    content: string,
    description = ""
  ): Promise<string> {
    const pageId = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-|-$/g, "");
    const fileName = `${pageId}.html`;
    const filePath = path.join(this.pagesDir(projectId), fileName);
    await fs.writeFile(filePath, content, "utf-8");

    await this.updateManifest(projectId, (m) => {
      if (!m.pages.find((p) => p.id === pageId)) {
        m.pages.push({
          id: pageId,
          name,
          path: `pages/${fileName}`,
          description,
          components: [],
        });
      }
      return m;
    });

    bus.emit("page.created", { projectId, pageId, name });
    return pageId;
  }

  async readPage(projectId: string, pageId: string): Promise<string> {
    const filePath = path.join(this.pagesDir(projectId), `${pageId}.html`);
    return fs.readFile(filePath, "utf-8");
  }

  async writePage(
    projectId: string,
    pageId: string,
    content: string
  ): Promise<void> {
    const filePath = path.join(this.pagesDir(projectId), `${pageId}.html`);
    await fs.writeFile(filePath, content, "utf-8");
    bus.emit("page.updated", { projectId, pageId });
  }

  async editPage(
    projectId: string,
    pageId: string,
    oldString: string,
    newString: string
  ): Promise<{ success: boolean; content: string }> {
    const content = await this.readPage(projectId, pageId);
    if (!content.includes(oldString)) {
      return { success: false, content };
    }
    const updated = content.replace(oldString, newString);
    await this.writePage(projectId, pageId, updated);
    return { success: true, content: updated };
  }

  async deletePage(projectId: string, pageId: string): Promise<void> {
    const filePath = path.join(this.pagesDir(projectId), `${pageId}.html`);
    await fs.unlink(filePath).catch(() => {});
    await this.updateManifest(projectId, (m) => {
      m.pages = m.pages.filter((p) => p.id !== pageId);
      m.flows = m.flows.filter(
        (f) => f.from !== pageId && f.to !== pageId
      );
      return m;
    });
    bus.emit("page.deleted", { projectId, pageId });
  }

  async listPages(
    projectId: string
  ): Promise<{ id: string; name: string; description: string }[]> {
    const manifest = await this.getManifest(projectId);
    return manifest.pages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    }));
  }

  async getPageFilePath(projectId: string, pageId: string): Promise<string> {
    return path.join(this.pagesDir(projectId), `${pageId}.html`);
  }

  private rulesPath(projectId: string): string {
    return path.join(this.projectDir(projectId), "PROTOTYPE_RULES.md");
  }

  async getRules(projectId: string): Promise<string | null> {
    try {
      return await fs.readFile(this.rulesPath(projectId), "utf-8");
    } catch {
      return null;
    }
  }

  async writeRules(projectId: string, content: string): Promise<void> {
    await fs.writeFile(this.rulesPath(projectId), content, "utf-8");
    bus.emit("project.updated", { projectId });
  }

  async listFiles(
    projectId: string
  ): Promise<{ path: string; name: string; type: "file" | "directory" }[]> {
    const dir = this.projectDir(projectId);
    const results: { path: string; name: string; type: "file" | "directory" }[] = [];

    const walk = async (currentDir: string, relativePath: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryRelPath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;
        if (entry.isDirectory()) {
          results.push({ path: entryRelPath, name: entry.name, type: "directory" });
          await walk(path.join(currentDir, entry.name), entryRelPath);
        } else {
          results.push({ path: entryRelPath, name: entry.name, type: "file" });
        }
      }
    };

    await walk(dir, "");
    return results;
  }
}
