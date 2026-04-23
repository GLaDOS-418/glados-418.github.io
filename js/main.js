/* ==========================================================================
   Theme Toggle (IIFE)
   
   Three-state dark mode: auto -> dark -> light -> auto.
   - "auto" removes data-theme, letting CSS media queries (OS preference) decide.
   - "dark" / "light" sets data-theme on <html>, overriding OS preference.
   - Stored in localStorage so it persists across page loads.
   - Listens for OS-level prefers-color-scheme changes when in auto mode.
   - Icon: sun icon when dark, moon icon when light. Uses feather-icons.
   ========================================================================== */
(function () {
  var STORAGE_KEY = "theme-preference";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
  }

  function applyTheme(theme) {
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    // dark.css is loaded with media="(prefers-color-scheme: dark)" for auto
    // mode. When user manually picks dark or light, the entire stylesheet is
    // ignored if OS doesn't match. Fix: force it active for manual overrides,
    // restore media query for auto.
    var darkLinks = document.querySelectorAll(
      'link[href*="dark.css"], link[href*="customDark"]'
    );
    darkLinks.forEach(function (link) {
      if (theme === "auto") {
        link.media = "(prefers-color-scheme: dark)";
      } else {
        // Force stylesheet active so html[data-theme] rules work
        link.media = "all";
      }
    });
    updateToggleIcon(theme);
  }

  function getEffectiveTheme(stored) {
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function updateToggleIcon(theme) {
    var btn = document.getElementById("dark-mode-toggle");
    if (!btn) return;
    var effective =
      theme === "dark" || theme === "light" ? theme : getEffectiveTheme(theme);
    // sun icon for dark mode (click to go light), moon icon for light mode
    btn.setAttribute(
      "aria-label",
      effective === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    var newIcon = effective === "dark" ? "sun" : "moon";
    // After feather.replace(), the <i> is gone and replaced with <svg>.
    // So we re-create the <i> element for feather to process again.
    btn.innerHTML = '<i data-feather="' + newIcon + '"></i>';
    if (typeof feather !== "undefined") feather.replace();
  }

  function cycleTheme() {
    var stored = getStoredTheme();
    var effective = getEffectiveTheme(stored);
    var next;
    // Smart toggle: skip states that look identical to current
    if (effective === "dark") {
      // Currently looks dark -> go to light
      next = "light";
    } else {
      // Currently looks light -> go to dark
      next = "dark";
    }
    setStoredTheme(next);
    applyTheme(next);
    // Notify mermaid.html to re-render diagrams with new theme
    window.dispatchEvent(new CustomEvent("theme-changed"));
  }

  // Apply stored theme immediately (only if user has explicitly chosen)
  var stored = getStoredTheme();
  if (stored && stored !== "auto") {
    applyTheme(stored);
  }
  // If no stored preference, leave data-theme unset so CSS media query (system default) controls

  // Set up toggle button after DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("dark-mode-toggle");
    if (btn) {
      btn.addEventListener("click", cycleTheme);
      updateToggleIcon(stored || "auto");
    }

    // Listen for OS theme changes when in auto mode
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function () {
        if (!getStoredTheme() || getStoredTheme() === "auto") {
          updateToggleIcon("auto");
        }
      });
  });
})();

/* ==========================================================================
   Sticky Heading Breadcrumb Trail (IIFE)
   
   Builds a "h2 > h3" breadcrumb trail that sticks below the site header
   as the user scrolls through a post. Behavior:
   - Scans all h2/h3 inside .markdown for heading hierarchy.
   - On scroll, finds the last heading above the viewport offset.
   - Walks backward to build an ancestor chain (h2 -> h3).
   - Renders clickable links in #heading-trail; clicking scrolls to heading.
   - Uses requestAnimationFrame throttle to keep scroll performance smooth.
   - Trail is hidden when user scrolls above the first heading.
   ========================================================================== */
// Sticky heading breadcrumb trail
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var trail = document.getElementById("heading-trail");
    var markdown = document.querySelector(".markdown");
    if (!trail || !markdown) return;

    var headings = Array.prototype.slice.call(
      markdown.querySelectorAll("h2, h3")
    );
    if (headings.length === 0) return;

    // Assign IDs to headings that don't have one (Hugo usually generates them)
    headings.forEach(function (h, i) {
      if (!h.id) h.id = "heading-" + i;
    });

    // Get heading level as number
    function level(h) {
      return parseInt(h.tagName.charAt(1), 10);
    }

    // Build the current trail from a heading
    function buildTrail(activeIndex) {
      if (activeIndex < 0) return [];
      var stack = [];
      var targetLevel = level(headings[activeIndex]);

      // Walk backward to build ancestor chain
      stack.push(headings[activeIndex]);
      var currentLevel = targetLevel;
      for (var i = activeIndex - 1; i >= 0; i--) {
        var l = level(headings[i]);
        if (l < currentLevel) {
          stack.unshift(headings[i]);
          currentLevel = l;
        }
      }
      return stack;
    }

    function renderTrail(stack) {
      if (stack.length === 0) {
        trail.classList.remove("visible");
        trail.innerHTML = "";
        return;
      }
      var html = stack
        .map(function (h) {
          return (
            '<a class="trail-item" href="#' +
            h.id +
            '">' +
            h.textContent +
            "</a>"
          );
        })
        .join('<span class="trail-separator">&gt;</span>');
      trail.innerHTML = html;
      trail.classList.add("visible");
    }

    // Compute header bottom for sticky offset
    function getHeaderBottom() {
      var header = document.querySelector(".header");
      if (!header) return 0;
      var rect = header.getBoundingClientRect();
      return rect.height;
    }

    // Set trail top position based on header height
    function updateTrailPosition() {
      trail.style.top = getHeaderBottom() + "px";
    }

    updateTrailPosition();
    window.addEventListener("resize", updateTrailPosition);

    // Track which heading was last scrolled past
    var lastActiveIndex = -1;

    // Use scroll-based tracking for reliability
    function updateOnScroll() {
      updateTrailPosition();
      var scrollY = window.scrollY || window.pageYOffset;
      var offset = getHeaderBottom() + 40; // header + trail + buffer
      var activeIndex = -1;

      for (var i = 0; i < headings.length; i++) {
        var rect = headings[i].getBoundingClientRect();
        if (rect.top <= offset) {
          activeIndex = i;
        } else {
          break;
        }
      }

      if (activeIndex !== lastActiveIndex) {
        lastActiveIndex = activeIndex;
        renderTrail(buildTrail(activeIndex));
      }
    }

    // Throttled scroll handler
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          updateOnScroll();
          ticking = false;
        });
        ticking = true;
      }
    });

    // Initial check
    updateOnScroll();
  });
})();

/* ==========================================================================
   Copy Button for Code Blocks & Mermaid Diagrams (IIFE)
   
   Adds a toolbar strip (.code-toolbar) with buttons above content:
   - Code blocks: single "Copy" button.
   - Mermaid diagrams: "Copy Code" + "Copy Image" (hidden until SVG renders)
     + "Fullscreen" (hidden until SVG renders).
   
   Key detail: Mermaid source text must be captured BEFORE mermaid.init()
   replaces the <pre class="mermaid"> content with SVG. This IIFE runs
   on DOMContentLoaded which fires before mermaid processes the diagrams
   (mermaid is loaded async via ESM import in mermaid.html).
   The "Copy Image" and "Fullscreen" buttons are created hidden here;
   mermaid.html wires them up and shows them after SVG is rendered.
   ========================================================================== */
// Copy button for code blocks and mermaid diagrams
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    function createCopyButton(label, getText, extraClass) {
      var btn = document.createElement("button");
      btn.className = "copy-btn" + (extraClass ? " " + extraClass : "");
      btn.setAttribute("aria-label", label);
      btn.textContent = label;
      if (getText) {
        btn.addEventListener("click", function () {
          var text = getText();
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = "Copied!";
            btn.classList.add("copied");
            setTimeout(function () {
              btn.textContent = label;
              btn.classList.remove("copied");
            }, 2000);
          });
        });
      }
      return btn;
    }

    function createActionButton(label, extraClass) {
      var btn = document.createElement("button");
      btn.className = "copy-btn" + (extraClass ? " " + extraClass : "");
      btn.setAttribute("aria-label", label);
      btn.textContent = label;
      return btn;
    }

    // Code blocks -- single "Copy" button
    var highlights = document.querySelectorAll(".highlight");
    highlights.forEach(function (block) {
      if (block.closest(".mermaid")) return;
      var pre = block.querySelector("pre");
      if (!pre) return;
      var toolbar = document.createElement("div");
      toolbar.className = "code-toolbar";
      toolbar.appendChild(
        createCopyButton("Copy", function () {
          var code = pre.querySelector("code");
          return (code || pre).textContent;
        })
      );
      block.insertBefore(toolbar, block.firstChild);
    });

    // Mermaid diagrams -- "Copy Code" + hidden "Copy Image" + hidden "Fullscreen"
    var mermaids = document.querySelectorAll(".mermaid");
    mermaids.forEach(function (el) {
      var source = el.textContent.trim();
      if (!source) return;
      var wrapper = el.closest(".mermaid-wrapper") || el.parentElement;

      var toolbar = document.createElement("div");
      toolbar.className = "code-toolbar";

      // Copy Code button (works immediately -- source is captured now)
      toolbar.appendChild(
        createCopyButton("Copy Code", function () {
          return source;
        })
      );

      // Copy Image button (hidden until mermaid.html wires it up after render)
      var copyImgBtn = createActionButton("Copy Image", "copy-img-btn");
      copyImgBtn.style.display = "none";
      toolbar.appendChild(copyImgBtn);

      // Fullscreen button (hidden until mermaid.html wires it up after render)
      var fullBtn = createActionButton("Fullscreen", "fullscreen-btn");
      fullBtn.style.display = "none";
      toolbar.appendChild(fullBtn);

      wrapper.insertBefore(toolbar, wrapper.firstChild);
    });
  });
})();
