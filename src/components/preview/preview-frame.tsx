"use client";

import { useRef, useEffect } from "react";

interface PreviewFrameProps {
  htmlContent: string;
  interactive?: boolean;
  enableElementSelection?: boolean;
  selectedElementId?: string | null;
}

export function PreviewFrame({
  htmlContent,
  interactive = false,
  enableElementSelection = false,
  selectedElementId,
}: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    const doc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Inter, system-ui, sans-serif; }
    ${!interactive ? "[data-action] { pointer-events: none; }" : ""}
    
    [data-element-name].nexagent-hover {
      outline: 2px solid #4F46E5 !important;
      outline-offset: 2px;
      cursor: pointer;
    }
    [data-element-name].nexagent-selected {
      outline: 2px solid #4F46E5 !important;
      outline-offset: 2px;
      background-color: rgba(79, 70, 229, 0.05) !important;
    }
    .nexagent-element-label {
      position: absolute;
      background: #4F46E5;
      color: white;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 0 0 4px 4px;
      pointer-events: none;
      z-index: 99999;
      white-space: nowrap;
      font-family: Inter, system-ui, sans-serif;
    }
  </style>
</head>
<body>
  ${htmlContent || '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#999;font-size:14px;">等待原型内容...</div>'}
  ${interactive ? INTERACTION_ENGINE_SCRIPT : ""}
  ${enableElementSelection ? ELEMENT_SELECTION_SCRIPT : ""}
</body>
</html>`;

    iframeRef.current.srcdoc = doc;
  }, [htmlContent, interactive, enableElementSelection]);

  useEffect(() => {
    if (!iframeRef.current || !selectedElementId) return;
    const iframe = iframeRef.current;
    const tryHighlight = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.querySelectorAll(".nexagent-selected").forEach((el) =>
          el.classList.remove("nexagent-selected")
        );
        const target = doc.querySelector(
          `[data-element-id="${selectedElementId}"]`
        );
        if (target) target.classList.add("nexagent-selected");
      } catch {
        // cross-origin safety
      }
    };
    iframe.addEventListener("load", tryHighlight);
    tryHighlight();
    return () => iframe.removeEventListener("load", tryHighlight);
  }, [selectedElementId]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts"
      title="Prototype Preview"
    />
  );
}

const INTERACTION_ENGINE_SCRIPT = `
<script>
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;

  var action = el.getAttribute('data-action');
  var target = el.getAttribute('data-target');
  var message = el.getAttribute('data-message');

  switch (action) {
    case 'navigate':
      window.parent.postMessage({ type: 'navigate', pageId: target }, '*');
      break;
    case 'back':
      window.parent.postMessage({ type: 'navigate-back' }, '*');
      break;
    case 'toast':
      showToast(message || 'Done');
      break;
    case 'toggle':
      var targetEl = document.getElementById(target);
      if (targetEl) targetEl.style.display = targetEl.style.display === 'none' ? '' : 'none';
      break;
    case 'modal-open':
      var modal = document.getElementById(target);
      if (modal) modal.style.display = 'flex';
      break;
    case 'modal-close':
      var openModal = document.querySelector('[data-modal].open, [style*="display: flex"][id]');
      if (openModal) openModal.style.display = 'none';
      break;
  }
});

function showToast(msg) {
  var toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;z-index:9999;animation:fadeInUp .3s';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 2000);
}

document.addEventListener('click', function(e) {
  var group = e.target.closest('[data-interaction="single-select"]');
  if (!group) return;
  var items = group.querySelectorAll('.active, [data-selected]');
  items.forEach(function(i) { i.classList.remove('active'); i.removeAttribute('data-selected'); });
  e.target.classList.add('active');
  e.target.setAttribute('data-selected', 'true');
});
<\/script>
`;

const ELEMENT_SELECTION_SCRIPT = `
<script>
(function() {
  var currentLabel = null;

  document.addEventListener('mouseover', function(e) {
    var el = e.target.closest('[data-element-name]');
    document.querySelectorAll('.nexagent-hover').forEach(function(h) {
      h.classList.remove('nexagent-hover');
    });
    if (currentLabel) { currentLabel.remove(); currentLabel = null; }

    if (!el) return;
    el.classList.add('nexagent-hover');

    var name = el.getAttribute('data-element-name');
    var rect = el.getBoundingClientRect();
    var label = document.createElement('div');
    label.className = 'nexagent-element-label';
    label.textContent = name;
    label.style.left = rect.left + window.scrollX + 'px';
    label.style.top = (rect.top + window.scrollY - 16) + 'px';
    document.body.appendChild(label);
    currentLabel = label;
  });

  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-element-name]');
    if (!el) return;

    if (el.hasAttribute('data-action')) return;

    e.preventDefault();
    e.stopPropagation();

    var id = el.getAttribute('data-element-id') || el.getAttribute('data-element-name');
    var name = el.getAttribute('data-element-name');

    document.querySelectorAll('.nexagent-selected').forEach(function(s) {
      s.classList.remove('nexagent-selected');
    });
    el.classList.add('nexagent-selected');

    window.parent.postMessage({
      type: 'element-selected',
      elementId: id,
      elementName: name
    }, '*');
  }, true);
})();
<\/script>
`;
