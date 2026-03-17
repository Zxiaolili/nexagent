import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  platform: text("platform", { enum: ["mobile", "web", "desktop"] })
    .notNull()
    .default("mobile"),
  themeJson: text("theme_json").default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  pageId: text("page_id").notNull(),
  title: text("title").notNull(),
  description: text("description").default(""),
  htmlContent: text("html_content").notNull().default(""),
  isEntry: integer("is_entry", { mode: "boolean" }).notNull().default(false),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const navigations = sqliteTable("navigations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  fromPageId: text("from_page_id").notNull(),
  toPageId: text("to_page_id").notNull(),
  trigger: text("trigger").notNull(),
  animation: text("animation", {
    enum: ["slide-left", "slide-right", "fade", "modal", "none"],
  }).default("slide-left"),
});

export const elements = sqliteTable("elements", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  pageId: text("page_id").notNull(),
  name: text("name").notNull(),
  selector: text("selector").notNull(),
  elementType: text("element_type", {
    enum: ["button", "input", "text", "image", "container", "list", "nav", "other"],
  })
    .notNull()
    .default("other"),
  order: integer("order").notNull().default(0),
});

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  snapshot: text("snapshot").notNull(),
  description: text("description").default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  toolCalls: text("tool_calls"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Navigation = typeof navigations.$inferSelect;
export type Element = typeof elements.$inferSelect;
export type NewElement = typeof elements.$inferInsert;
export type Version = typeof versions.$inferSelect;
export type Message = typeof messages.$inferSelect;
