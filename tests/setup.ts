import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(/* 在每个测试结束后卸载渲染的组件并清理 DOM。 */ () => {
  cleanup();
});
