#!/usr/bin/env node
/**
 * 给 @linxin666/dsh-pet 的渲染器打补丁：在桌宠 HUD 上加一个「形象 Q / 形象 3D」切换按钮。
 *
 * 原理：sprite2d 渲染器用 CSS background 显示 definition.atlasUrl 指向的图集。
 * 补丁把该 URL 派生为可切换的两套：
 *   默认：manifest 里的 spritesheet.png（豆包 Q 版）
 *   备选：previews/spritesheet-q.png（3D 动作版，与默认同 cell 尺寸）
 * 服务端只对 /pet/<id>/ 下的 pet.json、servable 清单和 previews/<name> 放行，
 * 因此第二套图集必须放在 <pet>/previews/spritesheet-q.png。
 *
 * 用法：
 *   node tools/apply-pet-patch.mjs                      自动定位 DSH_HOME/profiles/desktop
 *   node tools/apply-pet-patch.mjs <path/to/client.js>  指定文件
 * 幂等：已经打过补丁时直接退出。
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const target =
  process.argv[2] ??
  join(
    process.env.DSH_HOME ?? join(homedir(), ".dsh"),
    "profiles", "desktop", "node_modules", "@linxin666", "dsh-pet", "lib", "client.js",
  );

if (!existsSync(target)) {
  console.error("找不到 client.js：" + target);
  console.error("请先安装 @linxin666/dsh-pet，或显式传入路径。");
  process.exit(1);
}

let src = readFileSync(target, "utf8");
if (src.includes("atlasAlt")) {
  console.log("已打过补丁，跳过：" + target);
  process.exit(0);
}

const T = "\t";
const t3 = T.repeat(3);
const t9 = T.repeat(9);
const t10 = T.repeat(10);
const t11 = T.repeat(11);

const steps = [
  {
    name: "state",
    from: t3 + "const hideTimerRef = (0, react.useRef)(null);\n",
    to:
      t3 + "const hideTimerRef = (0, react.useRef)(null);\n" +
      t3 + "const [atlasAlt, setAtlasAlt] = (0, react.useState)(() => {\n" +
      T.repeat(4) + "try { return window.localStorage.getItem(\"dsh-pet-atlas-wizard\") === \"q\"; } catch { return false; }\n" +
      t3 + "});\n" +
      t3 + "(0, react.useEffect)(() => {\n" +
      T.repeat(4) + "try { window.localStorage.setItem(\"dsh-pet-atlas-wizard\", atlasAlt ? \"q\" : \"main\"); } catch { }\n" +
      t3 + "}, [atlasAlt]);\n",
  },
  {
    name: "atlasUrl",
    from: t3 + "const cell = definition.cell;\n",
    to:
      t3 +
      'const atlasUrl = atlasAlt && typeof definition.atlasUrl === "string" ? definition.atlasUrl.replace(/\\/spritesheet\\.[A-Za-z0-9]+$/, "/previews/spritesheet-q.png") : definition.atlasUrl;\n' +
      t3 + "const cell = definition.cell;\n",
  },
  { name: "img-src", from: "img.src = definition.atlasUrl;", to: "img.src = atlasUrl;" },
  { name: "load-deps", from: "}, [definition.atlasUrl, props.visual]);", to: "}, [atlasUrl, props.visual]);" },
  {
    name: "background",
    from: 'backgroundImage: imageReady ? "url(" + definition.atlasUrl + ")" : void 0,',
    to: 'backgroundImage: imageReady ? "url(" + atlasUrl + ")" : void 0,',
  },
  {
    name: "button",
    from:
      t10 + 'children: props.t("pet.gameplay.menu")\n' +
      t9 + "})\n",
    to:
      t10 + 'children: props.t("pet.gameplay.menu")\n' +
      t9 + "}),\n" +
      t9 + '/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {\n' +
      t10 + 'type: "button",\n' +
      t10 + "className: pet_module_css_default.action,\n" +
      t10 + "onClick: () => {\n" +
      t11 + "clearHideTimer();\n" +
      t11 + "setAtlasAlt(!atlasAlt);\n" +
      t10 + "},\n" +
      t10 + 'title: "切换形象：豆包 Q 版 / 3D 动作版",\n' +
      t10 + 'children: atlasAlt ? "形象 3D" : "形象 Q"\n' +
      t9 + "})\n",
  },
];

const touched = [];
for (const step of steps) {
  if (!src.includes(step.from)) {
    console.error("补丁失败：在 client.js 里找不到锚点 [" + step.name + "]。");
    console.error("可能插件版本已变，请手动适配：" + target);
    process.exit(1);
  }
  src = src.replace(step.from, step.to);
  touched.push(step.name);
}

copyFileSync(target, target + ".bak-orig");
writeFileSync(target, src, "utf8");
console.log("补丁完成：" + target);
console.log("改动：" + touched.join(", "));
console.log("备份：" + target + ".bak-orig");