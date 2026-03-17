import { NextRequest, NextResponse } from "next/server";
import {
  getPages,
  getPage,
  createPage,
  updatePageContent,
  deletePage,
  getNavigations,
  addNavigation,
  buildManifest,
  createSnapshot,
  getVersions,
  getElements,
  setElements,
  getAllElements,
} from "@/lib/prototype/manager";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const action = searchParams.get("action");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  switch (action) {
    case "list": {
      const pages = await getPages(projectId);
      return NextResponse.json({ pages });
    }
    case "getPage": {
      const pageId = searchParams.get("pageId");
      if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });
      const page = await getPage(projectId, pageId);
      return NextResponse.json(page || { htmlContent: "" });
    }
    case "navigations": {
      const navs = await getNavigations(projectId);
      return NextResponse.json({ navigations: navs });
    }
    case "manifest": {
      const manifest = await buildManifest(projectId);
      return NextResponse.json(manifest);
    }
    case "versions": {
      const versions = await getVersions(projectId);
      return NextResponse.json({ versions });
    }
    case "elements": {
      const pageId = searchParams.get("pageId");
      if (pageId) {
        const elems = await getElements(projectId, pageId);
        return NextResponse.json({ elements: elems });
      }
      const allElems = await getAllElements(projectId);
      const grouped: Record<string, typeof allElems> = {};
      for (const el of allElems) {
        if (!grouped[el.pageId]) grouped[el.pageId] = [];
        grouped[el.pageId].push(el);
      }
      return NextResponse.json({ elements: grouped });
    }
    case "fileTree": {
      const projectPages = await getPages(projectId);
      const tree = [
        {
          name: "nexagent.json",
          path: "nexagent.json",
          type: "file" as const,
        },
        {
          name: "theme.css",
          path: "theme.css",
          type: "file" as const,
        },
        {
          name: "pages",
          path: "pages",
          type: "directory" as const,
          children: projectPages.map((p) => ({
            name: `${p.pageId}.html`,
            path: `pages/${p.pageId}.html`,
            type: "file" as const,
          })),
        },
        {
          name: "shared",
          path: "shared",
          type: "directory" as const,
          children: [],
        },
      ];
      return NextResponse.json({ tree });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, action } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  switch (action) {
    case "createPage": {
      const id = await createPage(projectId, {
        pageId: body.pageId,
        title: body.title,
        description: body.description,
        htmlContent: body.htmlContent,
        isEntry: body.isEntry,
      });
      return NextResponse.json({ id });
    }
    case "updatePage": {
      await updatePageContent(projectId, body.pageId, body.htmlContent);
      return NextResponse.json({ ok: true });
    }
    case "deletePage": {
      await deletePage(projectId, body.pageId);
      return NextResponse.json({ ok: true });
    }
    case "addNavigation": {
      const navId = await addNavigation(projectId, {
        from: body.from,
        to: body.to,
        trigger: body.trigger,
        animation: body.animation,
      });
      return NextResponse.json({ id: navId });
    }
    case "snapshot": {
      const versionId = await createSnapshot(projectId, body.description);
      return NextResponse.json({ id: versionId });
    }
    case "setElements": {
      await setElements(projectId, body.pageId, body.elements || []);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
