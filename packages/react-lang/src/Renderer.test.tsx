// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { FormNameContext } from "./context";
import { useStateField } from "./hooks/useStateField";
import { createLibrary, defineComponent } from "./library";
import { Renderer } from "./Renderer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Dummy renderer — never actually renders DOM, used for parser/callback tests
const DummyComponent = (() => null) as any;

const TextContent = defineComponent({
  name: "TextContent",
  props: z.object({ text: z.string() }),
  description: "Displays text content",
  component: DummyComponent,
});

const baselineLibrary = createLibrary({
  components: [TextContent],
  root: "TextContent",
});

// openui-lang uses assignment syntax: `identifier = Component(args)`
const VALID_RESPONSE = 'root = TextContent("Hello world")';

async function mountRenderer(props: Parameters<typeof Renderer>[0]) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<Renderer {...props} />);
  });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

// ─── Renderer ───────────────────────────────────────────────────────────────

describe("Renderer", () => {
  it("renders without errors when response is null", async () => {
    const { container, unmount } = await mountRenderer({
      response: null,
      library: baselineLibrary,
    });

    expect(container).toBeDefined();
    await unmount();
  });

  it("renders without errors when response is empty string", async () => {
    const { container, unmount } = await mountRenderer({
      response: "",
      library: baselineLibrary,
    });

    expect(container).toBeDefined();
    await unmount();
  });

  it("calls onParseResult with null when response is null", async () => {
    const onParseResult = vi.fn();

    const { unmount } = await mountRenderer({
      response: null,
      library: baselineLibrary,
      onParseResult,
    });

    expect(onParseResult).toHaveBeenCalledWith(null);
    await unmount();
  });

  it("calls onParseResult with a ParseResult when given valid openui-lang", async () => {
    const onParseResult = vi.fn();

    const { unmount } = await mountRenderer({
      response: VALID_RESPONSE,
      library: baselineLibrary,
      onParseResult,
    });

    expect(onParseResult).toHaveBeenCalled();
    const result = onParseResult.mock.calls[onParseResult.mock.calls.length - 1]![0];
    expect(result).not.toBeNull();
    expect(result.root).toBeDefined();
    expect(result.root).not.toBeNull();
    await unmount();
  });

  it("parse result contains the correct component typeName", async () => {
    const onParseResult = vi.fn();

    const { unmount } = await mountRenderer({
      response: VALID_RESPONSE,
      library: baselineLibrary,
      onParseResult,
    });

    const result = onParseResult.mock.calls[onParseResult.mock.calls.length - 1]![0];
    expect(result?.root?.typeName).toBe("TextContent");
    await unmount();
  });

  it("defaults isStreaming to false", async () => {
    // Should not throw when isStreaming is omitted
    const { container, unmount } = await mountRenderer({
      response: null,
      library: baselineLibrary,
    });
    expect(container).toBeDefined();
    await unmount();
  });

  it("accepts isStreaming prop without errors", async () => {
    const { container, unmount } = await mountRenderer({
      response: null,
      library: baselineLibrary,
      isStreaming: true,
    });
    expect(container).toBeDefined();
    await unmount();
  });

  it("shows field input in a program without dynamic props", async () => {
    const Field = defineComponent({
      name: "Field",
      description: "Field",
      props: z.object({ name: z.string() }),
      component: ({ props }) => {
        const field = useStateField<string>(props.name);
        return <button onClick={() => field.setValue("typed")}>{field.value ?? ""}</button>;
      },
    });

    const Form = defineComponent({
      name: "Form",
      description: "Form",
      props: z.object({ name: z.string(), fields: z.array(Field.ref) }),
      component: ({ props, renderNode }) => (
        <FormNameContext.Provider value={props.name}>
          {renderNode(props.fields)}
        </FormNameContext.Provider>
      ),
    });

    const formLibrary = createLibrary({ components: [Form, Field], root: "Form" });

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <Renderer library={formLibrary} response={'root = Form("c", [e])\ne = Field("email")'} />,
      ),
    );
    const button = container.querySelector("button")!;
    await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(button.textContent).toBe("typed");
    await act(async () => root.unmount());
  });
});
