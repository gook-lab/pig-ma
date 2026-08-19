// pig-ma Import — Ultra-simple debug version
figma.showUI(__html__, { width: 360, height: 380 });

figma.ui.onmessage = function(msg) {
  if (msg.type !== "import") return;

  // Step 1: Acknowledge receipt
  figma.ui.postMessage({ type: "progress", message: "Received data. Editor: " + figma.editorType });

  try {
    var data = msg.data;
    var page = data.document && data.document.children && data.document.children[0];
    if (!page || !page.children) {
      figma.ui.postMessage({ type: "error", message: "Invalid structure" });
      return;
    }

    var nodes = page.children;
    figma.ui.postMessage({ type: "progress", message: "Processing " + nodes.length + " nodes..." });

    var created = [];
    var errors = [];

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      try {
        var bb = node.absoluteBoundingBox;
        if (!bb) { errors.push(i + ": no bounds"); continue; }

        var shape;
        if (figma.editorType === "figjam") {
          shape = figma.createShapeWithText();
          shape.shapeType = "ROUNDED_RECTANGLE";
        } else {
          shape = figma.createRectangle();
        }

        shape.x = bb.x;
        shape.y = bb.y;
        shape.resize(Math.max(10, bb.width || 50), Math.max(10, bb.height || 50));
        shape.name = node.name || "pig-ma " + i;

        figma.currentPage.appendChild(shape);
        created.push(shape);
      } catch (e) {
        errors.push(i + ": " + e.message);
      }
    }

    if (created.length > 0) {
      figma.currentPage.selection = created;
      figma.viewport.scrollAndZoomIntoView(created);
    }

    var result = "Done: " + created.length + "/" + nodes.length + " created";
    if (errors.length > 0) result += "\nErrors: " + errors.join(", ");
    figma.ui.postMessage({ type: "done", count: created.length, debug: result });

  } catch (e) {
    figma.ui.postMessage({ type: "error", message: "Fatal: " + e.message });
  }
};
