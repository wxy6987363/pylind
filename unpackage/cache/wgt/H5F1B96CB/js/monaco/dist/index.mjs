import * as o from "monaco-editor";
import { initMonaco as t, loadCss as m } from "./core.mjs";
import { cssWorker as s } from "./workers/css.mjs";
import { htmlWorker as x } from "./workers/html.mjs";
import { jsonWorker as i } from "./workers/json.mjs";
import { typescriptWorker as k } from "./workers/typescript.mjs";
import { editorWorker as W } from "./workers/editor.mjs";
export {
  s as cssWorker,
  W as editorWorker,
  x as htmlWorker,
  t as initMonaco,
  i as jsonWorker,
  m as loadCss,
  o as monaco,
  k as typescriptWorker
};
