import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  type ProjectManifest,
  type Theme,
  type PageMeta,
  type Navigation,
  generateThemeCSS,
  ProjectManifestSchema,
} from "./schema";

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Project Operations ──────────────────────────────────────────────

export async function createProject(data: {
  name: string;
  description?: string;
  platform?: "mobile" | "web" | "desktop";
  theme?: Partial<Theme>;
}): Promise<string> {
  const id = generateId();
  db.insert(schema.projects)
    .values({
      id,
      name: data.name,
      description: data.description || "",
      platform: data.platform || "mobile",
      themeJson: JSON.stringify(data.theme || {}),
    })
    .run();
  return id;
}

export async function getProject(projectId: string) {
  return db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
}

export async function listProjects() {
  return db.query.projects.findMany({
    orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
  });
}

export async function deleteProject(projectId: string) {
  db.delete(schema.projects).where(eq(schema.projects.id, projectId)).run();
}

// ─── Page Operations ─────────────────────────────────────────────────

export async function createPage(
  projectId: string,
  data: { pageId: string; title: string; description?: string; htmlContent: string; isEntry?: boolean }
): Promise<string> {
  const id = generateId();
  const existingPages = await getPages(projectId);
  db.insert(schema.pages)
    .values({
      id,
      projectId,
      pageId: data.pageId,
      title: data.title,
      description: data.description || "",
      htmlContent: data.htmlContent,
      isEntry: data.isEntry ?? existingPages.length === 0,
      order: existingPages.length,
    })
    .run();
  return id;
}

export async function updatePageContent(
  projectId: string,
  pageId: string,
  htmlContent: string
) {
  db.update(schema.pages)
    .set({ htmlContent, updatedAt: new Date() })
    .where(
      and(
        eq(schema.pages.projectId, projectId),
        eq(schema.pages.pageId, pageId)
      )
    )
    .run();
}

export async function getPages(projectId: string) {
  return db.query.pages.findMany({
    where: eq(schema.pages.projectId, projectId),
    orderBy: (pages, { asc }) => [asc(pages.order)],
  });
}

export async function getPage(projectId: string, pageId: string) {
  return db.query.pages.findFirst({
    where: and(
      eq(schema.pages.projectId, projectId),
      eq(schema.pages.pageId, pageId)
    ),
  });
}

export async function deletePage(projectId: string, pageId: string) {
  db.delete(schema.pages)
    .where(
      and(
        eq(schema.pages.projectId, projectId),
        eq(schema.pages.pageId, pageId)
      )
    )
    .run();
}

// ─── Navigation Operations ───────────────────────────────────────────

export async function addNavigation(
  projectId: string,
  nav: Omit<Navigation, "animation"> & { animation?: Navigation["animation"] }
) {
  const id = generateId();
  db.insert(schema.navigations)
    .values({
      id,
      projectId,
      fromPageId: nav.from,
      toPageId: nav.to,
      trigger: nav.trigger,
      animation: nav.animation || "slide-left",
    })
    .run();
  return id;
}

export async function getNavigations(projectId: string) {
  return db.query.navigations.findMany({
    where: eq(schema.navigations.projectId, projectId),
  });
}

// ─── Element Operations ──────────────────────────────────────────────

export async function getElements(projectId: string, pageId: string) {
  return db.query.elements.findMany({
    where: and(
      eq(schema.elements.projectId, projectId),
      eq(schema.elements.pageId, pageId)
    ),
    orderBy: (elements, { asc }) => [asc(elements.order)],
  });
}

export async function setElements(
  projectId: string,
  pageId: string,
  elems: {
    name: string;
    selector: string;
    elementType?: string;
  }[]
) {
  db.delete(schema.elements)
    .where(
      and(
        eq(schema.elements.projectId, projectId),
        eq(schema.elements.pageId, pageId)
      )
    )
    .run();

  for (let i = 0; i < elems.length; i++) {
    const el = elems[i];
    db.insert(schema.elements)
      .values({
        id: generateId(),
        projectId,
        pageId,
        name: el.name,
        selector: el.selector,
        elementType: (el.elementType as any) || "other",
        order: i,
      })
      .run();
  }
}

export async function getAllElements(projectId: string) {
  return db.query.elements.findMany({
    where: eq(schema.elements.projectId, projectId),
    orderBy: (elements, { asc }) => [asc(elements.order)],
  });
}

// ─── Version / Snapshot ──────────────────────────────────────────────

export async function createSnapshot(projectId: string, description?: string) {
  const project = await getProject(projectId);
  const projectPages = await getPages(projectId);
  const navs = await getNavigations(projectId);

  const snapshot = {
    project,
    pages: projectPages,
    navigations: navs,
    timestamp: new Date().toISOString(),
  };

  const id = generateId();
  db.insert(schema.versions)
    .values({
      id,
      projectId,
      snapshot: JSON.stringify(snapshot),
      description: description || "",
    })
    .run();
  return id;
}

export async function getVersions(projectId: string) {
  return db.query.versions.findMany({
    where: eq(schema.versions.projectId, projectId),
    orderBy: (versions, { desc }) => [desc(versions.createdAt)],
  });
}

// ─── Manifest Export ─────────────────────────────────────────────────

/**
 * Build a ProjectManifest (nexagent.json) from the database.
 * This is the format that code-generation agents consume.
 */
export async function buildManifest(projectId: string): Promise<ProjectManifest> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const projectPages = await getPages(projectId);
  const navs = await getNavigations(projectId);
  const theme = JSON.parse(project.themeJson || "{}");

  const manifest: ProjectManifest = {
    name: project.name,
    description: project.description || "",
    platform: project.platform,
    theme,
    pages: projectPages.map((p) => ({
      id: p.pageId,
      title: p.title,
      file: `pages/${p.pageId}.html`,
      description: p.description || "",
      isEntry: p.isEntry,
    })),
    navigation: navs.map((n) => ({
      from: n.fromPageId,
      to: n.toPageId,
      trigger: n.trigger,
      animation: n.animation || "slide-left",
    })),
    components: [],
  };

  return ProjectManifestSchema.parse(manifest);
}

// ─── Messages ────────────────────────────────────────────────────────

export async function addMessage(
  projectId: string,
  role: "user" | "assistant" | "system",
  content: string,
  toolCalls?: string
) {
  const id = generateId();
  db.insert(schema.messages)
    .values({ id, projectId, role, content, toolCalls })
    .run();
  return id;
}

export async function getMessages(projectId: string) {
  return db.query.messages.findMany({
    where: eq(schema.messages.projectId, projectId),
    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
  });
}
