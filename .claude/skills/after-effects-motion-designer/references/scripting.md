# ExtendScript starter

```js
// build_lowerthird.jsx - File > Scripts > Run Script File...
(function () {
  app.beginUndoGroup("Lower Third");
  try {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { alert("Select a composition first."); return; }

    var easeOut = [new KeyframeEase(0, 85)];   // fast out
    var easeIn  = [new KeyframeEase(0, 85)];

    // Bar
    var bar = comp.layers.addShape(); bar.name = "SHP_Bar";
    var grp = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var rect = grp.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([600, 90]);
    var fill = grp.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue([0.1, 0.4, 1]);
    bar.property("ADBE Transform Group").property("ADBE Position").setValue([360, 900]);

    // Scale X reveal
    var sc = bar.property("ADBE Transform Group").property("ADBE Scale");
    sc.setValueAtTime(0, [0, 100]);
    sc.setValueAtTime(0.5, [100, 100]);
    sc.setTemporalEaseAtKey(1, easeIn, easeIn);
    sc.setTemporalEaseAtKey(2, easeOut, easeOut);

    // Text
    var txt = comp.layers.addText("Name Surname"); txt.name = "TXT_Name";
    txt.property("ADBE Transform Group").property("ADBE Position").setValue([90, 915]);
  } catch (e) { alert("Error: " + e.toString() + " (line " + e.line + ")"); }
  app.endUndoGroup();
})();
```

## Snippets
- Add expression: `prop.expression = "wiggle(2,10)";`
- Add marker: `layer.property("Marker").setValueAtTime(t, new MarkerValue("Hit"));`
- Render queue: `app.project.renderQueue.items.add(comp)`; set output module template via `item.outputModule(1).applyTemplate("High Quality")`.
- Import: `app.project.importFile(new ImportOptions(File(path)))`.
- Loop selected layers: `comp.selectedLayers`.
