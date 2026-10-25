/* Preview-only interaction. No product code depends on this file. */
(function () {
  "use strict";

  var COPY_LABEL = "Copy";

  function popupOf(node) {
    return node.closest("[data-popup]");
  }

  function setIcon(button, symbolId) {
    var use = button.querySelector("use");
    if (use) {
      use.setAttribute("href", "#" + symbolId);
    }
  }

  function currentIcon(button) {
    var use = button.querySelector("use");
    return use ? use.getAttribute("href").replace("#", "") : "i-check";
  }

  function activateView(popup, view) {
    popup.querySelectorAll("[data-view]").forEach(function (tab) {
      var active = tab.getAttribute("data-view") === view;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    popup.querySelectorAll("[data-view-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-view-panel") !== view;
    });
  }

  function jumpTo(name, view) {
    var frame = document.getElementById("frame-" + name);
    if (!frame) {
      return;
    }

    if (view) {
      var popup = frame.querySelector("[data-popup]");
      if (popup && popup.querySelector('[data-view="' + view + '"]')) {
        activateView(popup, view);
      }
    }

    frame.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function flash(button) {
    var original = currentIcon(button);
    button.classList.add("is-confirmed");
    setIcon(button, "i-check");

    window.setTimeout(function () {
      button.classList.remove("is-confirmed");
      setIcon(button, original);
    }, 1400);
  }

  function handleCopy(button) {
    var label = button.querySelector("[data-copy-label]");
    if (!label) {
      return;
    }

    button.classList.add("is-copied");
    label.textContent = "Copied";
    setIcon(button, "i-check");

    window.setTimeout(function () {
      button.classList.remove("is-copied");
      label.textContent = COPY_LABEL;
      setIcon(button, "i-clipboard");
    }, 1600);
  }

  function handleSave(button) {
    var popup = popupOf(button);
    var label = button.querySelector("[data-save-label]");
    var outcome = button.getAttribute("data-save") || "ok";
    var detail = popup && popup.querySelector(".p-status-detail");

    if (!label || button.disabled) {
      return;
    }

    button.disabled = true;
    button.classList.remove("is-success", "is-error");
    label.textContent = "Saving";
    setIcon(button, "i-refresh");

    var icon = button.querySelector(".icon");
    if (icon) {
      icon.classList.add("is-spin");
    }

    window.setTimeout(function () {
      if (icon) {
        icon.classList.remove("is-spin");
      }
      button.disabled = false;

      if (outcome === "error") {
        button.classList.add("is-error");
        label.textContent = "Retry save";
        setIcon(button, "i-send");
      } else {
        button.classList.add("is-success");
        label.textContent = "Saved";
        setIcon(button, "i-check");
        if (detail) {
          detail.textContent = "Saved";
          detail.classList.remove("p-status-detail--error");
        }
      }
    }, 850);
  }

  function handleStatusTarget(select) {
    var popup = popupOf(select);
    if (!popup) {
      return;
    }

    var target = popup.querySelector(".p-status-target");
    if (!target) {
      return;
    }

    var option = select.options[select.selectedIndex];
    target.textContent = option && option.value === "" ? "Note only" : option.textContent;
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("button");
    if (!button || button.disabled) {
      return;
    }

    if (button.hasAttribute("data-jump")) {
      jumpTo(button.getAttribute("data-jump"), button.getAttribute("data-activate-view"));
      return;
    }

    if (button.hasAttribute("data-view")) {
      activateView(popupOf(button), button.getAttribute("data-view"));
      return;
    }

    if (button.hasAttribute("data-settings-toggle")) {
      var popup = popupOf(button);
      var settings = popup && popup.querySelector(".p-settings");
      if (settings) {
        settings.hidden = !settings.hidden;
      }
      return;
    }

    if (button.hasAttribute("data-copy")) {
      handleCopy(button);
      return;
    }

    if (button.hasAttribute("data-flash")) {
      flash(button);
      return;
    }

    if (button.hasAttribute("data-save")) {
      handleSave(button);
      return;
    }

    if (button.hasAttribute("data-width-toggle")) {
      var frame = button.closest(".frame");
      var wide = frame.classList.toggle("frame--wide");
      button.classList.toggle("is-wide", wide);
      button.textContent = wide ? "360px" : "560px";
    }
  });

  document.addEventListener("change", function (event) {
    var select = event.target.closest("select");
    if (select) {
      handleStatusTarget(select);
    }
  });
})();
