"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type KeyboardEvent,
} from "react";
import { useWorkspaceStore, type ElementInfo } from "@/lib/store/workspace";
import { AtSign, FileText, Box } from "lucide-react";

export interface MentionRef {
  pageId: string;
  pageName: string;
  elementId?: string;
  elementName?: string;
}

export interface MentionInputHandle {
  focus: () => void;
  insertMention: (ref: MentionRef) => void;
  getValue: () => string;
  getMentions: () => MentionRef[];
  clear: () => void;
}

interface PageOption {
  pageId: string;
  title: string;
}

interface MentionInputProps {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onMentionsChange?: (mentions: MentionRef[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

type MenuLevel = "closed" | "pages" | "elements";

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput(
    {
      projectId,
      value,
      onChange,
      onSubmit,
      onMentionsChange,
      placeholder,
      disabled,
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const [mentions, setMentions] = useState<MentionRef[]>([]);
    const [menuLevel, setMenuLevel] = useState<MenuLevel>("closed");
    const [menuFilter, setMenuFilter] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [atPosition, setAtPosition] = useState<number>(-1);

    const [pages, setPages] = useState<PageOption[]>([]);
    const [selectedPageForElements, setSelectedPageForElements] =
      useState<PageOption | null>(null);
    const [pageElements, setPageElements] = useState<ElementInfo[]>([]);

    const elements = useWorkspaceStore((s) => s.elements);
    const setStoreElements = useWorkspaceStore((s) => s.setElements);

    useEffect(() => {
      fetchPages();
    }, [projectId]);

    async function fetchPages() {
      try {
        const res = await fetch(
          `/api/prototype?projectId=${projectId}&action=list`
        );
        if (res.ok) {
          const data = await res.json();
          setPages(
            (data.pages || []).map((p: any) => ({
              pageId: p.pageId,
              title: p.title,
            }))
          );
        }
      } catch {}
    }

    async function fetchElements(pageId: string) {
      if (elements[pageId]) {
        setPageElements(elements[pageId]);
        return;
      }
      try {
        const res = await fetch(
          `/api/prototype?projectId=${projectId}&action=elements&pageId=${pageId}`
        );
        if (res.ok) {
          const data = await res.json();
          const elems: ElementInfo[] = (data.elements || []).map((e: any) => ({
            id: e.id || e.name,
            name: e.name,
            selector: e.selector,
            type: e.elementType || "other",
          }));
          setPageElements(elems);
          setStoreElements(pageId, elems);
        }
      } catch {
        setPageElements([]);
      }
    }

    // Auto-resize
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height =
          Math.min(textareaRef.current.scrollHeight, 160) + "px";
      }
    }, [value]);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      insertMention: (mention: MentionRef) => {
        addMention(mention);
      },
      getValue: () => value,
      getMentions: () => mentions,
      clear: () => {
        setMentions([]);
        onChange("");
      },
    }));

    const addMention = useCallback(
      (mention: MentionRef) => {
        const newMentions = [...mentions, mention];
        setMentions(newMentions);
        onMentionsChange?.(newMentions);

        const label = mention.elementName
          ? `@${mention.pageName}/${mention.elementName}`
          : `@${mention.pageName}`;

        const before = value.slice(0, atPosition >= 0 ? atPosition : value.length);
        const after = value.slice(
          atPosition >= 0
            ? atPosition + menuFilter.length + 1
            : value.length
        );
        onChange(before + label + " " + after);

        closeMenu();
        textareaRef.current?.focus();
      },
      [mentions, value, atPosition, menuFilter, onChange, onMentionsChange]
    );

    const closeMenu = useCallback(() => {
      setMenuLevel("closed");
      setMenuFilter("");
      setSelectedIndex(0);
      setAtPosition(-1);
      setSelectedPageForElements(null);
      setPageElements([]);
    }, []);

    const handleInputChange = useCallback(
      (newValue: string) => {
        onChange(newValue);

        if (menuLevel !== "closed") {
          const textAfterAt = newValue.slice(atPosition + 1);
          const spaceIdx = textAfterAt.indexOf(" ");
          const filterText =
            spaceIdx >= 0 ? textAfterAt.slice(0, spaceIdx) : textAfterAt;

          if (filterText.includes("/") && menuLevel === "pages") {
            const [pagePart] = filterText.split("/");
            const matchedPage = pages.find(
              (p) =>
                p.title.toLowerCase() === pagePart.toLowerCase() ||
                p.pageId.toLowerCase() === pagePart.toLowerCase()
            );
            if (matchedPage) {
              setSelectedPageForElements(matchedPage);
              fetchElements(matchedPage.pageId);
              setMenuLevel("elements");
              setMenuFilter(filterText.split("/")[1] || "");
              setSelectedIndex(0);
              return;
            }
          }

          setMenuFilter(menuLevel === "elements" ? (filterText.split("/")[1] || "") : filterText);
          setSelectedIndex(0);
        }
      },
      [menuLevel, atPosition, pages, onChange]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (menuLevel !== "closed") {
          const items = getFilteredItems();

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            if (items.length > 0) selectItem(items[selectedIndex]);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            closeMenu();
            return;
          }
          if (e.key === "Backspace" && menuLevel === "elements" && menuFilter === "") {
            e.preventDefault();
            setMenuLevel("pages");
            setSelectedPageForElements(null);
            setPageElements([]);
            setSelectedIndex(0);
            return;
          }
        }

        if (e.key === "@") {
          const cursorPos = textareaRef.current?.selectionStart ?? value.length;
          setAtPosition(cursorPos);
          setMenuLevel("pages");
          setMenuFilter("");
          setSelectedIndex(0);
          return;
        }

        if (e.key === "Enter" && !e.shiftKey && menuLevel === "closed") {
          e.preventDefault();
          onSubmit();
        }
      },
      [menuLevel, menuFilter, selectedIndex, value, onSubmit, closeMenu]
    );

    function getFilteredItems(): Array<{ id: string; label: string; sublabel?: string }> {
      if (menuLevel === "pages") {
        return pages
          .filter(
            (p) =>
              !menuFilter ||
              p.title.toLowerCase().includes(menuFilter.toLowerCase()) ||
              p.pageId.toLowerCase().includes(menuFilter.toLowerCase())
          )
          .map((p) => ({ id: p.pageId, label: p.title }));
      }
      if (menuLevel === "elements") {
        const items: Array<{ id: string; label: string; sublabel?: string }> = [];
        // First option: select the page itself (no specific element)
        if (selectedPageForElements) {
          items.push({
            id: `page:${selectedPageForElements.pageId}`,
            label: selectedPageForElements.title,
            sublabel: "整个页面",
          });
        }
        const filtered = pageElements.filter(
          (el) =>
            !menuFilter ||
            el.name.toLowerCase().includes(menuFilter.toLowerCase())
        );
        for (const el of filtered) {
          items.push({
            id: `element:${el.id}`,
            label: el.name,
            sublabel: el.type,
          });
        }
        return items;
      }
      return [];
    }

    function selectItem(item: { id: string; label: string }) {
      if (menuLevel === "pages") {
        const page = pages.find((p) => p.pageId === item.id);
        if (page) {
          setSelectedPageForElements(page);
          fetchElements(page.pageId);
          setMenuLevel("elements");
          setMenuFilter("");
          setSelectedIndex(0);
        }
        return;
      }

      if (menuLevel === "elements" && selectedPageForElements) {
        if (item.id.startsWith("page:")) {
          addMention({
            pageId: selectedPageForElements.pageId,
            pageName: selectedPageForElements.title,
          });
        } else {
          const elementId = item.id.replace("element:", "");
          addMention({
            pageId: selectedPageForElements.pageId,
            pageName: selectedPageForElements.title,
            elementId,
            elementName: item.label,
          });
        }
      }
    }

    const filteredItems = getFilteredItems();

    // Close menu on outside click
    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (
          menuRef.current &&
          !menuRef.current.contains(e.target as HTMLElement) &&
          textareaRef.current &&
          !textareaRef.current.contains(e.target as HTMLElement)
        ) {
          closeMenu();
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [closeMenu]);

    return (
      <div className="relative">
        {/* Mention chips */}
        {mentions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {mentions.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                <AtSign className="h-3 w-3" />
                {m.elementName
                  ? `${m.pageName}/${m.elementName}`
                  : m.pageName}
                <button
                  onClick={() => {
                    const newMentions = mentions.filter((_, j) => j !== i);
                    setMentions(newMentions);
                    onMentionsChange?.(newMentions);
                  }}
                  className="ml-0.5 hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "描述你想要的修改... 输入 @ 引用页面或元素"}
          rows={1}
          disabled={disabled}
          className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Dropdown menu */}
        {menuLevel !== "closed" && filteredItems.length > 0 && (
          <div
            ref={menuRef}
            className="absolute bottom-full left-0 mb-1 w-64 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg z-50"
          >
            {/* Breadcrumb for elements level */}
            {menuLevel === "elements" && selectedPageForElements && (
              <div className="px-3 py-1.5 border-b text-xs text-muted-foreground flex items-center gap-1">
                <button
                  onClick={() => {
                    setMenuLevel("pages");
                    setSelectedPageForElements(null);
                    setPageElements([]);
                    setSelectedIndex(0);
                  }}
                  className="hover:text-foreground transition-colors"
                >
                  页面
                </button>
                <span>/</span>
                <span className="text-foreground font-medium">
                  {selectedPageForElements.title}
                </span>
              </div>
            )}

            {filteredItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {menuLevel === "pages" ? (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : item.id.startsWith("page:") ? (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Box className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="truncate">{item.label}</span>
                  {item.sublabel && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.sublabel}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
