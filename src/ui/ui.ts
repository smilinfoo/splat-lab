import { state } from "./state";

export function createUI(onChange: () => void) {
  const root = document.createElement("div");

  root.style.position = "absolute";
  root.style.top = "10px";
  root.style.left = "10px";
  root.style.padding = "10px";
  root.style.background = "rgba(0,0,0,0.6)";
  root.style.color = "white";
  root.style.font = "12px sans-serif";
  //root.style.pointerEvents = 'none';
  root.style.zIndex = 10;

  // --- Size slider
  const sizeLabel = document.createElement("div");

  const updateSizeLabel = (value: number) => {
    sizeLabel.innerText = `Splat Size: ${value.toFixed(2)}`;
  };

  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = "0.1";
  sizeInput.max = "4";
  sizeInput.step = "0.01";
  sizeInput.value = String(state.splatSize);
  updateSizeLabel(state.splatSize);

  sizeInput.oninput = (e) => {
    state.splatSize = parseFloat((e.target as HTMLInputElement).value);
    updateSizeLabel(state.splatSize);
    onChange();
  };

  // --- Opacity slider
  const opacityLabel = document.createElement("div");
  opacityLabel.innerText = "Opacity";

  const opacityInput = document.createElement("input");
  opacityInput.type = "range";
  opacityInput.min = "0.1";
  opacityInput.max = "1";
  opacityInput.step = "0.05";
  opacityInput.value = String(state.opacity);

  opacityInput.oninput = (e) => {
    state.opacity = parseFloat((e.target as HTMLInputElement).value);
    onChange();
  };

  // --- Blending toggle
  const blendToggle = document.createElement("button");
  blendToggle.innerText = "Toggle Additive";

  blendToggle.onclick = () => {
    state.additive = !state.additive;
    onChange();
  };

  // --- Debug / view mode dropdown (one-way: UI -> state; value is the u_debug_mode index)
  const modeLabel = document.createElement("div");
  modeLabel.innerText = "View Mode";

  const modeSelect = document.createElement("select");
  const modes: [number, string][] = [
    [0, "Plain"],
    [1, "Opaque color"],
    [2, "Scale"],
    [3, "Rotation (broken)"],
    [4, "R (stub)"],
    [5, "Opacity"],
  ];
  for (const [value, label] of modes) {
    const option = document.createElement("option");
    option.value = String(value);
    option.innerText = label;
    modeSelect.appendChild(option);
  }
  modeSelect.value = String(state.debugMode);

  modeSelect.onchange = (e) => {
    state.debugMode = parseInt((e.target as HTMLSelectElement).value, 10);
    onChange();
  };

  root.appendChild(modeLabel);
  root.appendChild(modeSelect);
  root.appendChild(document.createElement("br"));
  root.appendChild(document.createElement("br"));

  root.appendChild(sizeLabel);
  root.appendChild(sizeInput);
  root.appendChild(document.createElement("br"));

  root.appendChild(opacityLabel);
  root.appendChild(opacityInput);
  root.appendChild(document.createElement("br"));

  root.appendChild(blendToggle);

  document.body.appendChild(root);
}