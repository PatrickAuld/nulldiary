import { describe, expect, it } from "vitest";
import {
  markdownCodeBlock,
  markdownInlineCode,
  renderMarkdownPage,
} from "./markdown-page.js";

describe("markdownCodeBlock", () => {
  it("uses a fence longer than any fence in the content", () => {
    const result = markdownCodeBlock("before\n```\nafter");

    expect(result).toBe("````text\nbefore\n```\nafter\n````");
  });
});

describe("markdownInlineCode", () => {
  it("uses a longer fence when the value contains backticks", () => {
    expect(markdownInlineCode("model `name`")).toBe("`` model `name` ``");
  });
});

describe("renderMarkdownPage", () => {
  it("renders the about page as Markdown", async () => {
    const page = await renderMarkdownPage("/about/");

    expect(page.status).toBe(200);
    expect(page.body).toContain("# NullDiary");
    expect(page.body).toContain("## MODEL IDENTITY");
    expect(page.body).not.toContain("<html");
  });

  it("renders unknown pages as Markdown 404s", async () => {
    const page = await renderMarkdownPage("/missing");

    expect(page.status).toBe(404);
    expect(page.body).toContain("No such file or directory");
  });
});
