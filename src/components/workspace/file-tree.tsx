"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspaceStore, type FileNode } from "@/lib/store/workspace";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";

interface FileTreeProps {
  projectId: string;
}

function FileTreeNode({
  node,
  depth = 0,
}: {
  node: FileNode;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(node.type === "directory");

  const isDir = node.type === "directory";
  const hasChildren = isDir && node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) setExpanded(!expanded);
        }}
        className={`w-full text-left flex items-center gap-1 py-1 px-2 text-xs transition-colors hover:bg-accent/50 ${
          isDir ? "text-foreground" : "text-muted-foreground"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ projectId }: FileTreeProps) {
  const fileTree = useWorkspaceStore((s) => s.fileTree);
  const setFileTree = useWorkspaceStore((s) => s.setFileTree);

  const fetchFileTree = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/prototype?projectId=${projectId}&action=fileTree`
      );
      if (res.ok) {
        const data = await res.json();
        setFileTree(data.tree || []);
      }
    } catch {
      // API not yet available
    }
  }, [projectId, setFileTree]);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  if (!fileTree || fileTree.length === 0) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          暂无文件
          <br />
          创建页面后将自动生成文件结构
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {fileTree.map((node) => (
        <FileTreeNode key={node.path} node={node} />
      ))}
    </div>
  );
}
